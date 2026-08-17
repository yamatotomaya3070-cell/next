-- 00015: キャラクター立ち絵アセット（Stage3）
--
-- スタイルガイド（00014）のキャラ × 表情ごとに1枚の立ち絵をAI生成し、
-- Storage に保存して「資産化」する。生成のたびに作り直さず、以降の全動画で使い回す。
-- 同一キャラで表情だけ差し替えるため seed を保持する（一貫性の基準）。
-- 職員/管理者のみ閲覧・操作可（裏方データ。就労者には直接見せない）。

create table if not exists public.character_assets (
  id uuid primary key default gen_random_uuid(),
  style_guide_id uuid not null references public.style_guides(id) on delete cascade,
  character_key text not null,                     -- StyleGuideContent.characters[].key
  expression text not null,                        -- normal / happy / surprised / thinking
  seed int not null default 0,                     -- 生成時のシード（一貫性の基準）
  storage_path text not null,                      -- character-assets バケット内のパス
  mime_type text not null default 'image/png',
  provider text not null default 'mock',           -- gemini / mock / mock(fallback)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (style_guide_id, character_key, expression)
);

create index if not exists idx_character_assets_guide
  on public.character_assets(style_guide_id);

alter table public.character_assets enable row level security;

drop policy if exists "staff manage character_assets" on public.character_assets;
create policy "staff manage character_assets" on public.character_assets
  for all using (public.is_staff()) with check (public.is_staff());

comment on table public.character_assets is
  'キャラクター立ち絵アセット（スタイルガイドのキャラ×表情）。Storageの character-assets バケットに実体、ここにメタデータ。';

-- 立ち絵の保存先バケット（非公開。署名付きURLで職員のみ閲覧）
insert into storage.buckets (id, name, public)
values ('character-assets', 'character-assets', false)
on conflict (id) do nothing;

-- バケットへの操作は職員/管理者のみ許可（RLS on storage.objects）
drop policy if exists "staff read character-assets" on storage.objects;
create policy "staff read character-assets" on storage.objects
  for select using (bucket_id = 'character-assets' and public.is_staff());

drop policy if exists "staff write character-assets" on storage.objects;
create policy "staff write character-assets" on storage.objects
  for insert with check (bucket_id = 'character-assets' and public.is_staff());

drop policy if exists "staff update character-assets" on storage.objects;
create policy "staff update character-assets" on storage.objects
  for update using (bucket_id = 'character-assets' and public.is_staff());
