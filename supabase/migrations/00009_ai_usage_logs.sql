-- =============================================================
-- 00009: AI利用ログ（コスト・トークン数の可視化）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 前提: 00001（is_staff() ヘルパ関数）。
-- Gemini 呼び出しごとに1行記録し、月額コスト試算・使いすぎ検知に使う。
-- INSERT はサービスロール（src/lib/supabase/admin.ts の createAdminClient,
-- RLSバイパス）でのみ行うため、通常ロール向けの INSERT ポリシーは作らない
-- （＝就労者・職員セッションからは書けない）。閲覧は職員のみ。
-- テーブル未適用・env未設定でも、記録側は握りつぶして生成を継続する設計
-- （src/lib/ai/gemini.ts の logAiUsage）。
-- =============================================================

create table ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,          -- 'gemini' 等
  model text not null,             -- 'gemini-2.0-flash' 等
  kind text not null,              -- 'task' | 'similar_case' | 'mask' | 'source_script' | 'grade'
  prompt_tokens int,
  output_tokens int,
  total_tokens int,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_logs_created on ai_usage_logs (created_at desc);
create index idx_ai_usage_logs_kind on ai_usage_logs (kind, created_at desc);

-- ---------- RLS ----------

alter table ai_usage_logs enable row level security;

-- 閲覧は職員のみ。INSERT はサービスロール（RLSバイパス）のみを想定し、
-- 通常ロール向けの insert/update/delete ポリシーはあえて作らない。
create policy "職員のみAI利用ログを閲覧" on ai_usage_logs
  for select using (is_staff());
