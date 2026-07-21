-- =============================================================
-- AI動画編集トレーニングシステム 初期スキーマ（フェーズ1 MVP）
-- 提案版 v1 — 適用前にレビューしてください
-- =============================================================

-- ---------- ENUM 型 ----------

create type user_role as enum ('trainee', 'staff', 'admin');

-- practice = 練習課題(フェーズ1) / real = 実案件(フェーズ2)
create type task_type as enum ('practice', 'real');

create type task_status as enum ('draft', 'published', 'archived');

create type assignment_status as enum (
  'not_started',   -- 未着手
  'in_progress',   -- 作業中
  'submitted',     -- 提出済み・添削待ち
  'feedback',      -- フィードバック返却済み（修正対応中含む）
  'completed'      -- 完了（職員承認）
);

create type material_kind as enum (
  'request_doc',     -- 模擬依頼書（クラウドワークス風案件文）
  'manual',          -- 操作手順書（ステップ分割）
  'script',          -- 字幕用台本
  'sample',          -- 完成見本
  'revision_note',   -- 修正指示
  'screenshot_guide' -- スクショ/GIF付きガイド
);

create type feedback_source as enum ('ai', 'staff');

create type feedback_status as enum (
  'pending_review', -- AI生成済み・職員承認待ち
  'approved',       -- 職員承認済み（利用者に表示）
  'rejected'        -- 職員が差し戻し（利用者に非表示）
);

create type progress_event as enum (
  'start', 'pause', 'resume', 'progress', 'submit', 'consult', 'break'
);

-- 就労適性の8項目（要件定義 §3）
create type aptitude_key as enum (
  'pc_endurance',        -- パソコン作業の継続可否
  'detail_focus',        -- 細かい作業への集中力
  'instruction_follow',  -- 指示書に沿った作業遂行力
  'repetitive_work',     -- 繰り返し作業の可否
  'asking_for_help',     -- 分からない時に相談できるか
  'revision_response',   -- 修正指示への対応力
  'deadline_awareness',  -- 納期意識
  'motivation'           -- 動画編集への興味・達成感
);

-- ---------- テーブル ----------

-- 利用者・職員プロフィール（auth.users と 1:1）
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'trainee',
  display_name text not null,
  display_name_kana text,                  -- ふりがな
  furigana_enabled boolean not null default false, -- ふりがな表示 ON/OFF
  step_mode_enabled boolean not null default true, -- 一工程ずつ表示モード
  large_text_enabled boolean not null default false,
  read_aloud_enabled boolean not null default false,
  break_interval_minutes int not null default 50 check (break_interval_minutes between 10 and 180),
  notes text,                              -- 職員用メモ（配慮事項など）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 課題（練習案件 / 実案件）
create table tasks (
  id uuid primary key default gen_random_uuid(),
  type task_type not null default 'practice',
  status task_status not null default 'draft',
  title text not null,
  summary text,                            -- 依頼の一言要約
  difficulty int not null default 1 check (difficulty between 1 and 5),
  skill_tags text[] not null default '{}', -- 例: {'cut','telop','bgm','export'}
  estimated_minutes int check (estimated_minutes > 0), -- 作業時間の目安
  due_in_days int,                         -- 割当日からの納期日数（練習用）
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 課題の教材（AI生成 + 職員作成）
create table task_materials (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  kind material_kind not null,
  title text not null,
  content text,                            -- 本文（Markdown。ふりがなは 漢字《かんじ》 記法）
  steps jsonb,                             -- 手順書: [{ "text": "...", "image_url": null, "tip": "..." }]
  media_url text,                          -- GIF/スクショ/見本動画の Storage パス
  sort_order int not null default 0,
  generated_by feedback_source not null default 'ai',
  is_approved boolean not null default false, -- 職員承認後に利用者へ表示
  created_at timestamptz not null default now()
);

-- 課題の割当（利用者ごとの難易度別配布）
create table task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status assignment_status not null default 'not_started',
  due_at timestamptz,                      -- この利用者の納期
  assigned_by uuid references profiles (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- 提出物
create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references task_assignments (id) on delete cascade,
  version int not null default 1,          -- 修正提出で +1
  file_path text,                          -- Storage: submissions バケット内パス
  file_name text,
  note text,                               -- 利用者のコメント・工夫した点
  self_check jsonb,                        -- 納品前セルフチェック回答 [{item, checked}]
  work_minutes int check (work_minutes >= 0), -- 自己申告 + ログ集計
  submitted_at timestamptz not null default now(),
  unique (assignment_id, version)
);

-- 添削・フィードバック（AI採点 → 職員承認 → 利用者表示）
create table feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  source feedback_source not null,
  status feedback_status not null default 'pending_review',
  score int check (score between 0 and 100),
  summary text,                            -- 総評（短文・平易な日本語）
  good_points text[],                      -- 良かった点
  improve_points text[],                   -- 次に直す点
  criteria jsonb,                          -- 項目別採点 [{key, label, score, comment}]
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 進捗・作業ログ
create table progress_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references task_assignments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  event progress_event not null,
  progress_percent int check (progress_percent between 0 and 100),
  minutes_delta int,                       -- このイベントまでの作業時間（分）
  is_delayed boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

-- 利用者の適性・特性記録（職員のみ閲覧・編集）
create table user_aptitudes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  key aptitude_key not null,
  rating int not null check (rating between 1 and 5),
  note text,
  recorded_by uuid references profiles (id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- 質問ログ（利用者 → AI/職員。フェーズ1では職員宛て質問のみ使用）
create table qa_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  assignment_id uuid references task_assignments (id) on delete set null,
  question text not null,
  answer text,
  answered_by feedback_source,
  needs_staff boolean not null default true, -- AIが根拠を持たない場合 true（推測回答禁止）
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 匿名化済み実案件由来の教材ソース（フェーズ2で使用。定義のみ先行）
create table knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_summary text,                     -- 匿名化済み案件要約
  content jsonb,                           -- 教材化データ
  is_anonymized boolean not null default false,
  consent_confirmed boolean not null default false, -- 依頼者許諾確認済み
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- インデックス ----------

create index idx_task_materials_task on task_materials (task_id, sort_order);
create index idx_assignments_user on task_assignments (user_id, status);
create index idx_assignments_task on task_assignments (task_id);
create index idx_submissions_assignment on submissions (assignment_id);
create index idx_feedback_submission on feedback (submission_id);
create index idx_feedback_status on feedback (status) where status = 'pending_review';
create index idx_progress_assignment on progress_logs (assignment_id, created_at);
create index idx_aptitudes_user on user_aptitudes (user_id, key, recorded_at desc);
create index idx_qa_user on qa_logs (user_id, created_at desc);

-- ---------- updated_at 自動更新 ----------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger trg_tasks_updated before update on tasks
  for each row execute function set_updated_at();

-- ---------- 新規ユーザー登録時に profiles を自動作成 ----------

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'trainee'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
