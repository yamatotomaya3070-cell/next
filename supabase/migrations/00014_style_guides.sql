-- 00014: シリーズ共通スタイルガイド（担当YouTuberのチャンネル固定プロフィール）
--
-- 建前＝「1人のYouTuberから長期的に動画編集を請け負う専属エディター」。
-- スタイルガイドを一度だけ確定してJSONで固定保存し、以降の全生成工程
-- （台本・立ち絵/背景の画像生成・テロップ・サムネ・依頼書）がこの content を参照する。
-- 独自性（模倣回避）の担保もここが起点。
--
-- 編集は「新バージョンを追記 → is_active を1件だけ有効化」で行う（履歴を残す）。
-- 職員/管理者のみ閲覧・編集可（RLS）。就労者には直接見せない裏方データ。

create table if not exists public.style_guides (
  id uuid primary key default gen_random_uuid(),
  name text not null,                              -- このガイドの名前（例:「たけしの雑学ラボ」）
  version int not null default 1,                  -- 追記型バージョン
  is_active boolean not null default false,        -- 有効な1件のみ全生成が参照
  content jsonb not null,                          -- StyleGuideContent（画風/パレット/キャラ/テロップ/依頼主 等）
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- is_active は同時に1件だけ（部分ユニークインデックス）
create unique index if not exists idx_style_guides_single_active
  on public.style_guides(is_active)
  where is_active = true;

create index if not exists idx_style_guides_created_at
  on public.style_guides(created_at desc);

alter table public.style_guides enable row level security;

-- 職員/管理者のみ全操作可（裏方データ。就労者には出さない）
drop policy if exists "staff manage style_guides" on public.style_guides;
create policy "staff manage style_guides" on public.style_guides
  for all using (public.is_staff()) with check (public.is_staff());

comment on table public.style_guides is
  'シリーズ共通スタイルガイド（担当YouTuberのチャンネル固定プロフィール）。is_active な1件を全生成工程が参照する。';
