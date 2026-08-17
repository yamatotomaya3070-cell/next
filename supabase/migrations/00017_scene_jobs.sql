-- =============================================================
-- 00017: SCENE動画案件の生成ジョブ管理（高品質金融解説・完全ハイブリッド）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 前提: 00001/00002（profiles, tasks, task_materials, is_staff, set_updated_at）に依存。
-- テーマ→AIがSCENE設計図生成→完成見本レンダ→no-telop素材書き出し→DaVinci手順書→
-- 案件(tasks/task_materials)登録、という工程をジョブとして状態管理する。
-- 実処理は ffmpeg/sharp/Gemini の使えるローカルワーカー（scripts/scene/worker.ts）が行い、
-- このテーブルを介して進捗を共有する（Vercel等サーバーレスでは実行しない）。
-- =============================================================

create type scene_job_status as enum (
  'pending',              -- 生成待ち
  'generating_scene',     -- SCENE設計図（PROJECT→SCENE[]）生成中
  'rendering_video',      -- 完成見本MP4レンダリング中
  'building_materials',   -- no-telop素材（図解/立ち絵/音声/BGM/タイミング表）書き出し中
  'building_manual',      -- DaVinci手順書・依頼書・タイムライン生成中
  'registering_task',     -- 案件（tasks/task_materials）登録中
  'completed',
  'failed'
);

create table scene_jobs (
  id uuid primary key default gen_random_uuid(),
  theme text not null,
  audience text not null default '投資初心者',
  target_minutes int not null default 6 check (target_minutes between 3 and 15),
  difficulty int not null default 3 check (difficulty between 1 and 5),
  status scene_job_status not null default 'pending',
  progress int not null default 0 check (progress between 0 and 100),
  project jsonb,           -- 生成・検証済みの VideoProject（SCENE設計図）
  artifacts jsonb,         -- 生成物の storage パス {sample_video, assets_zip}
  error text,
  error_stage scene_job_status,
  retry_count int not null default 0,
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

create index idx_scene_jobs_status on scene_jobs (status, created_at);

create trigger trg_scene_jobs_updated before update on scene_jobs
  for each row execute function set_updated_at();

-- 工程ごとの実行ログ
create table scene_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references scene_jobs (id) on delete cascade,
  stage scene_job_status not null,
  event text not null check (event in ('started', 'completed', 'failed', 'skipped')),
  detail text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index idx_scene_job_events_job on scene_job_events (job_id, created_at);

-- ---------- RLS ----------

alter table scene_jobs       enable row level security;
alter table scene_job_events enable row level security;

-- ジョブ管理は職員のみ（完成見本・素材パスを含むため利用者には公開しない）
create policy "職員のみSCENEジョブを管理" on scene_jobs
  for all using (is_staff()) with check (is_staff());
create policy "職員のみSCENEジョブログを閲覧" on scene_job_events
  for all using (is_staff()) with check (is_staff());
