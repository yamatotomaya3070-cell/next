-- =============================================================
-- 00006: AI動画案件の生成ジョブ管理（ゆっくり解説風・レベル1 MVP）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 前提: 00001/00002 のみに依存（00003〜00005 が未適用でも単独で適用可能）
-- 生成パイプライン（台本→音声→字幕→レンダリング→パッケージ→案件登録）を
-- ジョブとして状態管理する。実処理はローカルワーカー
-- （scripts/video/worker.ts）が行い、このテーブルを介して進捗を共有する。
-- =============================================================

-- ジョブの工程ステータス
create type video_job_status as enum (
  'pending',              -- 生成待ち
  'generating_script',    -- 台本JSON生成中
  'generating_voice',     -- TTS音声生成中
  'generating_assets',    -- 画像・素材準備中
  'generating_subtitles', -- 字幕タイミング算出中
  'rendering_preview',    -- 完成見本レンダリング中
  'packaging_assets',     -- 素材パッケージ化・アップロード中
  'registering_task',     -- 案件（tasks/task_materials）登録中
  'completed',
  'failed'
);

create table video_jobs (
  id uuid primary key default gen_random_uuid(),
  theme text not null,
  difficulty int not null default 1 check (difficulty between 1 and 3),
  target_duration_sec int not null default 60 check (target_duration_sec between 30 and 300),
  status video_job_status not null default 'pending',
  progress int not null default 0 check (progress between 0 and 100),
  -- 失敗時に失敗工程から再開するための中間成果物
  script jsonb,            -- 検証済み台本JSON（VideoScript）
  timeline jsonb,          -- 音声実測後のシーンタイミング・字幕データ
  answer_data jsonb,       -- 正解データ（字幕内容・基準タイミング・完成尺・必須編集項目・許容誤差）
  artifacts jsonb,         -- 生成ファイルの storage パス {sample_video, assets_zip, srt, ...}
  error text,
  error_stage video_job_status,
  retry_count int not null default 0,
  provider text,           -- 台本生成に使ったAIプロバイダ
  -- 二重実行防止: ワーカーが処理開始時に自分の識別子でロックする
  locked_by text,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  task_id uuid references tasks (id) on delete set null, -- 登録された案件
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_video_jobs_status on video_jobs (status, created_at);

create trigger trg_video_jobs_updated before update on video_jobs
  for each row execute function set_updated_at();

-- 工程ごとの実行ログ（開始・完了・失敗・所要・エラー詳細）
create table video_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references video_jobs (id) on delete cascade,
  stage video_job_status not null,
  event text not null check (event in ('started', 'completed', 'failed', 'skipped')),
  detail text,             -- エラー内容・ffmpeg標準エラーの要約など
  duration_ms int,
  created_at timestamptz not null default now()
);

create index idx_video_job_events_job on video_job_events (job_id, created_at);

-- 支給素材（ZIP等）を教材として登録できるようにする
-- ※ ADD VALUE は同一トランザクション内で値を使用しなければ実行可能（PG12+）
alter type material_kind add value if not exists 'source_assets';

-- 完成見本を「就労者が最初から閲覧できる」/「職員だけが閲覧できる（提出後に公開）」で
-- 切り替えられるようにする。kind='sample' のみで使用する想定（既定値は公開）
alter table task_materials add column visible_before_submission boolean not null default true;

-- ---------- RLS ----------

alter table video_jobs       enable row level security;
alter table video_job_events enable row level security;

-- ジョブ管理は職員のみ（正解データ・生成物パスを含むため利用者には一切公開しない）
create policy "職員のみ動画ジョブを管理" on video_jobs
  for all using (is_staff()) with check (is_staff());
create policy "職員のみ動画ジョブログを閲覧" on video_job_events
  for all using (is_staff()) with check (is_staff());
