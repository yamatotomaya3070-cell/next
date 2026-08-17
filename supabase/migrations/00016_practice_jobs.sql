-- 00016: 練習素材ジョブ（Stage4配線／素材mp4レンダリング）
--
-- 練習素材ジェネレーター(/staff/practice/new)で確定した案件を「ジョブ」として登録し、
-- ffmpeg が使えるワーカー(scripts/video/practice-worker.ts)が素材mp4を書き出す。
-- video_jobs と同じ claim/lock パターン（locked_by/locked_at + retry_count/error）。
-- Vercel(サーバーレス)では ffmpeg が動かないため、レンダリングはローカル/Docker のワーカーが担う。
-- 職員/管理者のみ（裏方データ）。

create table if not exists public.practice_jobs (
  id uuid primary key default gen_random_uuid(),
  style_guide_id uuid references public.style_guides(id) on delete set null,
  theme text not null,
  difficulty text not null default 'intermediate',   -- beginner / intermediate / advanced
  target_seconds int not null default 600,           -- must合計の想定完成尺
  script jsonb not null,                              -- GeneratedPracticeScript（正規化済み）
  style_guide jsonb not null,                         -- 生成時点のスタイルガイドのスナップショット
  status text not null default 'pending',             -- pending / rendering / completed / failed
  progress int not null default 0,
  provider text,                                      -- 台本生成のprovider（gemini/mock等）
  artifacts jsonb,                                    -- { sample_video, assets_zip } のStorageパス
  answer_data jsonb,                                  -- 正解データ（完成見本/機械検品の目標）
  error text,
  error_stage text,
  retry_count int not null default 0,
  locked_by text,
  locked_at timestamptz,
  created_by uuid references public.profiles(id),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_practice_jobs_status on public.practice_jobs(status);
create index if not exists idx_practice_jobs_created_at on public.practice_jobs(created_at desc);

alter table public.practice_jobs enable row level security;

drop policy if exists "staff manage practice_jobs" on public.practice_jobs;
create policy "staff manage practice_jobs" on public.practice_jobs
  for all using (public.is_staff()) with check (public.is_staff());

comment on table public.practice_jobs is
  '練習素材ジョブ。/staff/practice で登録し、ffmpegワーカーが素材mp4一式(ZIP)と完成見本を書き出す。';
