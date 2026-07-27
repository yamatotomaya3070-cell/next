-- =============================================================
-- 00008: 提出動画の機械検品ジョブ管理（フェーズ1.5後半）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 前提: 00001 のみに依存（submissions テーブル）。
-- 00006（video_jobs.answer_data）が未適用/空でも、このテーブル自体は
-- 単独で作成できる。その場合は提出時に対象ジョブが見つからず
-- submission_inspections への insert が単に発生しない（既存フローに影響なし）。
--
-- 対象は「AI動画生成パイプライン（video_jobs）で作られた案件」の提出物のみ。
-- 尺・解像度・音声/映像トラック有無・音量を ffmpeg/ffprobe で実測し、
-- video_jobs.answer_data と機械的に突き合わせる。実処理はローカルワーカー
-- （scripts/video/inspect-worker.ts）が行い、このテーブルを介して進捗を共有する。
-- =============================================================

create type submission_inspection_status as enum (
  'pending',    -- 検品待ち
  'probing',    -- 提出動画をダウンロード・ffprobe実測中
  'comparing',  -- 正解データとの突き合わせ中
  'completed',
  'skipped',    -- 対象タスクに正解データが無く検品対象外だった
  'failed'
);

create table submission_inspections (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  status submission_inspection_status not null default 'pending',
  progress int not null default 0 check (progress between 0 and 100),
  probe_result jsonb,      -- ffprobe/ffmpeg実測値 {durationSec,width,height,hasVideo,hasAudio,meanVolumeDb}
  check_result jsonb,      -- 突き合わせ結果 {checks:[{key,label,status,expected,actual}],autoScore}
  error text,
  error_stage submission_inspection_status,
  retry_count int not null default 0,
  -- 二重実行防止: ワーカーが処理開始時に自分の識別子でロックする
  locked_by text,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id)
);

create index idx_submission_inspections_status on submission_inspections (status, created_at);

create trigger trg_submission_inspections_updated before update on submission_inspections
  for each row execute function set_updated_at();

-- ---------- RLS ----------

alter table submission_inspections enable row level security;

-- 検品結果は職員のみ（video_jobs/material_answersと同じ方針。利用者には公開しない）
create policy "職員のみ検品結果を管理" on submission_inspections
  for all using (is_staff()) with check (is_staff());
