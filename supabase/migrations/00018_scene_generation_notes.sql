-- =============================================================
-- 00018: SCENE動画生成のナレッジ（指摘・修正メモ）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 前提: 00001/00002（profiles, is_staff, set_updated_at）に依存。
-- YouTube動画生成で出た「動画の不備・仕様書の不備・発音の誤り」等を職員が記録し、
-- 次回以降の生成プロンプト＋音声合成(TTS)に自動注入して品質を継続的に上げる。
-- UIには一覧を大きく出さず、AIの生成知識として溜める用途。
-- =============================================================

create table scene_generation_notes (
  id uuid primary key default gen_random_uuid(),
  -- 指摘・修正メモ（例:「iDeCoは『イデコ』と読む。アイデコは誤り」）
  note text not null,
  -- 種別（発音・数値・構成・仕様書 など）。任意。
  category text,
  -- 発音ルール向け: 対象語と読み（TTS注入用）。任意。
  term text,
  reading text,
  is_active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_scene_generation_notes_active on scene_generation_notes (is_active, created_at);

create trigger trg_scene_generation_notes_updated before update on scene_generation_notes
  for each row execute function set_updated_at();

alter table scene_generation_notes enable row level security;
create policy "職員のみ生成ナレッジを管理" on scene_generation_notes
  for all using (is_staff()) with check (is_staff());
