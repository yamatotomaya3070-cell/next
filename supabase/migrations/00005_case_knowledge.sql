-- =============================================================
-- 00005: 実案件ナレッジ（case_knowledge）
--
-- 目的:
--   実案件を投入したとき、匿名化済みの要点（ジャンル・難易度・注意事項）を
--   自動でナレッジとして蓄積し、模擬案件のAI生成時に参考情報として使う。
--
-- 注意:
--   - pgvector 等の拡張は不要。Supabase SQL Editor でそのまま実行できます。
--   - 00003（提案版・未適用）の real_cases / case_documents とは独立。
--     00003 を適用する際は、本テーブルからの移行を検討してください。
--   - 格納するテキストは必ず匿名化済みのもののみ（原文は保存しない）。
-- =============================================================

create table case_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,                       -- 例: 「実案件由来: 飲食店PR動画の編集」
  genre text,                                -- 'vlog' | 'ad' | 'subtitle' | 'clip' | 'interview' | 'other'
  skill_tags text[] not null default '{}',   -- 必要スキル（tasks.skill_tags と同じ語彙）
  difficulty int check (difficulty between 1 and 5),
  caution_points text[] not null default '{}', -- 実案件から抽出した注意事項・修正されがちな点
  masked_case_text text not null,            -- 匿名化済みの案件要約（原文は保存しない）
  masking_report jsonb,                      -- 匿名化レポート（除去項目・残存リスク）
  source text not null default 'real_case',  -- 'real_case'（将来: 'manual' 等）
  converted_task_id uuid references tasks (id) on delete set null, -- 生成された練習案件
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_case_knowledge_created on case_knowledge (created_at desc);
create index idx_case_knowledge_skill_tags on case_knowledge using gin (skill_tags);

-- 匿名化済みとはいえ実案件由来の情報のため、閲覧・管理とも職員のみ
alter table case_knowledge enable row level security;

create policy "職員のみ実案件ナレッジを管理" on case_knowledge
  for all using (is_staff()) with check (is_staff());
