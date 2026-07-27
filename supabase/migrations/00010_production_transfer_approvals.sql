-- =============================================================
-- 00010: 本番移行の承認記録（承認者・承認日時・所見）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 前提: 00001（profiles, is_staff()）。
-- これまで /staff/users/[id] の「本番移行判定」は直近実績からの算出目安のみで、
-- スタッフが最終承認した事実（誰が・いつ・所見）を永続化していなかった
-- （page.tsx の TODO を回収）。
-- 追記型: 最新行が現在の承認状態。取り消しは decision='revoked' の行を追加する。
-- =============================================================

create table production_transfer_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  decision text not null check (decision in ('approved', 'revoked')),
  note text,
  approved_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_transfer_approvals_user
  on production_transfer_approvals (user_id, created_at desc);

-- ---------- RLS ----------

alter table production_transfer_approvals enable row level security;

-- 承認記録は職員のみが閲覧・記録できる
create policy "職員のみ本番移行承認を管理" on production_transfer_approvals
  for all using (is_staff()) with check (is_staff());
