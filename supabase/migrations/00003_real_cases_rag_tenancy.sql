-- =============================================================
-- 00003: 実案件取り込み・RAG・模擬納品チャット・カリキュラム段階・
--        施設テナント・AI利用コスト記録
-- 提案版 v1 — 適用前にレビューしてください
--
-- 対応要件:
--   - 初期指示書 §1(模擬案件生成の入力となる実案件), §2(カリキュラム),
--     §3(模擬納品フロー), §5(実案件RAG), §7(権限・コスト管理)
--   - 要件定義書v2 フェーズ3(実案件取り込み)・フェーズ4(自己成長ループ)
-- 注意:
--   - pgvector 拡張が必要（Supabase は Dashboard > Database > Extensions で有効化可能）
--   - 既存テーブルへの変更は facility_id / stage_id 列の追加のみ（null許容・後方互換）
-- =============================================================

create extension if not exists vector;

-- ---------- 施設（将来のSaaSテナント単位） ----------

create table facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,                        -- 招待コード・URL用スラッグ
  created_at timestamptz not null default now()
);

-- 既存テーブルにテナント列を追加（現行の単一施設運用では null のままで動作。
-- SaaS化時に backfill + not null 化 + RLSの施設スコープ強制を別マイグレーションで行う）
alter table profiles add column facility_id uuid references facilities (id) on delete set null;
alter table tasks    add column facility_id uuid references facilities (id) on delete set null;

create index idx_profiles_facility on profiles (facility_id);
create index idx_tasks_facility on tasks (facility_id);

-- ログインユーザーの所属施設（RLS・アプリ双方で使用）
create or replace function current_facility_id()
returns uuid language sql stable security definer set search_path = public as $$
  select facility_id from profiles where id = auth.uid();
$$;

-- ---------- 実案件（クラウドワークス等からの取り込み） ----------

create type real_case_source as enum (
  'paste',   -- 依頼文のコピペ（半自動）
  'email'    -- 転送メールの解析（自動・フェーズ3後半）
);

create type real_case_status as enum (
  'imported',    -- 原文取り込みのみ
  'structured',  -- AI構造化済み
  'masked',      -- 匿名化済み・職員確認待ち
  'approved',    -- 職員が匿名化と許諾を確認済み（教材化・RAG投入可）
  'converted',   -- 練習教材に変換済み
  'archived'
);

create table real_cases (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities (id) on delete set null,
  source real_case_source not null default 'paste',
  status real_case_status not null default 'imported',
  title text,
  raw_content text not null,               -- 原文（依頼メール/依頼文の全文。職員のみ閲覧）
  structured jsonb,                        -- AI構造化: 目的・完成尺・必要作業・素材・納期・修正条件・不明点
  masked_content text,                     -- 匿名化済みテキスト（教材生成・RAGへの唯一の入力とする）
  masking_report jsonb,                    -- 除去・置換した固有名詞等の記録 + 残存リスク
  consent_confirmed boolean not null default false, -- 依頼者の二次利用許諾
  consent_note text,
  converted_task_id uuid references tasks (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_real_cases_status on real_cases (status, created_at desc);

create trigger trg_real_cases_updated before update on real_cases
  for each row execute function set_updated_at();

-- ---------- RAG用ドキュメント（匿名化済み案件の断片 + 埋め込み） ----------

create table case_documents (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities (id) on delete set null,
  real_case_id uuid references real_cases (id) on delete cascade,
  doc_type text not null default 'case_summary', -- case_summary / request_doc / revision_note / qa
  content text not null,                   -- ※匿名化済み(status=approved)のテキストのみ格納すること
  embedding vector(768),                   -- Gemini text-embedding-004 (768次元)
  metadata jsonb,                          -- {genre, difficulty, skill_tags, ...}
  created_at timestamptz not null default now()
);

create index idx_case_documents_case on case_documents (real_case_id);
create index idx_case_documents_embedding on case_documents
  using hnsw (embedding vector_cosine_ops);

-- 類似案件検索（模擬案件生成プロンプトへの参考例注入に使用）
create or replace function match_case_documents(
  query_embedding vector(768),
  match_count int default 5
)
returns table (id uuid, real_case_id uuid, doc_type text, content text, metadata jsonb, similarity float)
language sql stable as $$
  select d.id, d.real_case_id, d.doc_type, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from case_documents d
  where d.embedding is not null
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------- 模擬納品チャット（疑似クライアントとのやり取り） ----------

create type case_message_sender as enum (
  'trainee',      -- 利用者
  'client_ai',    -- AIが演じる依頼者（職員承認後に利用者へ表示）
  'client_staff'  -- 職員が演じる依頼者
);

create table case_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references task_assignments (id) on delete cascade,
  sender case_message_sender not null,
  body text not null,
  is_approved boolean not null default false, -- client_ai の下書きは職員承認後に表示（原則3の踏襲）
  approved_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_case_messages_assignment on case_messages (assignment_id, created_at);

-- ---------- 学習カリキュラム（段階とクリア条件） ----------

create table curriculum_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  sort_order int not null,
  required_skill_tags text[] not null default '{}',
  clear_criteria jsonb,                    -- 例: {"min_completed_tasks": 2, "min_score": 70}
  created_at timestamptz not null default now()
);

create type stage_progress_status as enum ('locked', 'in_progress', 'cleared');

create table user_stage_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  stage_id uuid not null references curriculum_stages (id) on delete cascade,
  status stage_progress_status not null default 'locked',
  judged_by uuid references profiles (id) on delete set null, -- 「本番投入可」判定は職員が行う
  judged_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, stage_id)
);

alter table tasks add column stage_id uuid references curriculum_stages (id) on delete set null;

-- 初期カリキュラム（初期指示書 §2 の段階設計）
insert into curriculum_stages (code, title, sort_order, required_skill_tags, clear_criteria, description) values
  ('cut',      'カット編集',      1, '{cut,export}',     '{"min_completed_tasks": 2, "min_score": 70}', '不要な部分を切り取り、書き出すまでの基本操作'),
  ('telop',    'テロップ挿入',    2, '{telop,brief}',    '{"min_completed_tasks": 2, "min_score": 70}', '台本どおりに字幕・テロップを入れる'),
  ('bgm_se',   'BGM・効果音',     3, '{bgm,volume}',     '{"min_completed_tasks": 2, "min_score": 70}', 'BGM/SEの挿入と音量バランスの調整'),
  ('revision', '修正対応',        4, '{revision}',       '{"min_completed_tasks": 1, "min_score": 75}', '修正指示を読み取り、期日内に再納品する'),
  ('delivery', '納品マナー',      5, '{brief,export}',   '{"min_completed_tasks": 1, "min_score": 80}', '報告・相談・ファイル名規則・納期を守った納品')
on conflict (code) do nothing;

-- ---------- AI利用コスト記録 ----------

create table ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities (id) on delete set null,
  user_id uuid references profiles (id) on delete set null,
  feature text not null,                   -- 'generate_task' | 'generate_similar_case' | 'grade' | 'embed' 等
  model text not null,
  input_tokens int,
  output_tokens int,
  estimated_cost_usd numeric(10, 5),
  created_at timestamptz not null default now()
);

create index idx_ai_usage_created on ai_usage_logs (created_at desc);
create index idx_ai_usage_facility on ai_usage_logs (facility_id, created_at desc);

-- =============================================================
-- RLS
-- =============================================================

alter table facilities          enable row level security;
alter table real_cases          enable row level security;
alter table case_documents      enable row level security;
alter table case_messages       enable row level security;
alter table curriculum_stages   enable row level security;
alter table user_stage_progress enable row level security;
alter table ai_usage_logs       enable row level security;

-- 施設: 認証済みユーザーは自施設の名前を閲覧可、管理は職員のみ
create policy "認証済みユーザーは施設を閲覧" on facilities
  for select using (auth.uid() is not null);
create policy "職員は施設を管理" on facilities
  for all using (is_staff()) with check (is_staff());

-- 実案件: 原文・許諾情報を含むため職員のみ
create policy "職員のみ実案件を管理" on real_cases
  for all using (is_staff()) with check (is_staff());

-- RAGドキュメント: 職員のみ（教材生成はサーバー側 service role でも可）
create policy "職員のみRAGドキュメントを管理" on case_documents
  for all using (is_staff()) with check (is_staff());

-- 模擬納品チャット:
--   利用者 = 自分の割当のスレッドのみ。client_ai の未承認下書きは見えない
create policy "利用者は自分のチャットを閲覧" on case_messages
  for select using (
    is_staff()
    or (
      exists (
        select 1 from task_assignments a
        where a.id = case_messages.assignment_id and a.user_id = auth.uid()
      )
      and (sender = 'trainee' or is_approved)
    )
  );
create policy "利用者は自分のチャットに投稿" on case_messages
  for insert with check (
    is_staff()
    or (
      sender = 'trainee'
      and exists (
        select 1 from task_assignments a
        where a.id = case_messages.assignment_id and a.user_id = auth.uid()
      )
    )
  );
create policy "職員はチャットを更新" on case_messages
  for update using (is_staff());
create policy "職員はチャットを削除" on case_messages
  for delete using (is_staff());

-- カリキュラム定義: 認証済み全員が閲覧、管理は職員
create policy "認証済みユーザーはカリキュラムを閲覧" on curriculum_stages
  for select using (auth.uid() is not null);
create policy "職員はカリキュラムを管理" on curriculum_stages
  for all using (is_staff()) with check (is_staff());

-- 段階進捗: 利用者は自分の進捗のみ閲覧（判定・更新は職員）
create policy "利用者は自分の段階進捗を閲覧" on user_stage_progress
  for select using (user_id = auth.uid() or is_staff());
create policy "職員は段階進捗を管理" on user_stage_progress
  for all using (is_staff()) with check (is_staff());

-- AIコスト: 職員のみ
create policy "職員のみAI利用ログを閲覧" on ai_usage_logs
  for select using (is_staff());
create policy "職員はAI利用ログを記録" on ai_usage_logs
  for insert with check (is_staff());
