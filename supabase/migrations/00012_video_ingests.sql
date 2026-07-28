-- 00012: 実案件/参考動画の取り込み・解析（docs/00011 の本格版・方式C）
--
-- 職員が動画を取り込み → ワーカー(ingest-worker)がffmpegで縮小 → Gemini動画理解で
-- 編集パターン(EditingPattern)を抽出 → editing_pattern に保存。
-- その結果を案件生成の editingPatternContext に注入し、実CW水準の生成に用いる。
--
-- 原本(storage_path)・解析結果とも職員限定(RLS)。実案件は consent_status=approved が配布/学習の前提。

create table if not exists public.video_ingests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  genre_hint text,                                 -- 解析時のヒント（ジャンル/テーマ）
  source_kind text not null default 'reference',   -- reference | ingested_final | ingested_pair | stock
  storage_path text not null,                      -- materialsバケット内の原本パス（職員のみ）
  consent_status text not null default 'pending',  -- pending | approved | rejected（実案件は許諾必須）
  status text not null default 'pending',          -- pending | analyzing | analyzed | failed
  editing_pattern jsonb,                           -- 解析結果(EditingPattern)。analyzed時に入る
  provider text,                                    -- gemini | mock | mock(fallback)
  error text,
  retry_count int not null default 0,
  locked_by text,
  locked_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_ingests_status on public.video_ingests(status);

alter table public.video_ingests enable row level security;

-- 職員/管理者のみ全操作可（原本・解析結果とも職員限定。就労者には出さない）
drop policy if exists "staff manage video_ingests" on public.video_ingests;
create policy "staff manage video_ingests" on public.video_ingests
  for all using (public.is_staff()) with check (public.is_staff());

comment on table public.video_ingests is
  '参考/実案件動画の取り込み・解析。editing_pattern を案件生成へ注入する（docs/00011 Loop A 方式C）';
