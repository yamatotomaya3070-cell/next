-- =============================================================
-- 00004: 素材動画教材と正解データ（フェーズ1.5）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 素材動画（利用者が編集する元動画）を教材として扱えるようにする。
-- 正解データ（カット区間のタイムスタンプ・完成尺）は、利用者に見せては
-- いけないため task_materials の列ではなく職員専用RLSの別テーブルに置く。
-- 提出物の機械検品・内容ベース自動採点（フェーズ1.5後半）で使う。
-- =============================================================

-- PostgreSQL 12+ では ALTER TYPE ... ADD VALUE はトランザクション内で実行可能
-- （同一トランザクション内でその値を使用しなければよい）
alter type material_kind add value if not exists 'source_video';

-- 素材動画の正解データ。scripts/generate-source-video.ts の answer.json と同形:
-- { totalSeconds, keepSeconds, segments: [{index, kind, cutReason, text, start, end}] }
create table material_answers (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references task_materials (id) on delete cascade,
  answer_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (material_id)
);

alter table material_answers enable row level security;

-- 正解データは職員のみ（利用者が閲覧できる教材と物理分離してRLSで遮断）
create policy "職員のみ正解データを管理" on material_answers
  for all using (is_staff()) with check (is_staff());
