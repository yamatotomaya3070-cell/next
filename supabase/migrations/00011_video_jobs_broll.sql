-- 00011: video_jobs に実写Bロール背景の設定を追加
--
-- 背景を静止画スライドから実写ストック動画(Pexels)へ切り替えるための2列。
-- worker.ts がこの値を runPipeline({ useBroll, brollKeywords }) に渡す。
-- 既定は false / 空配列 = 従来どおり静止画背景（完全な後方互換）。
-- RLS は既存の video_jobs ポリシーがそのまま適用されるため変更不要。

alter table public.video_jobs
  add column if not exists use_broll boolean not null default false,
  add column if not exists broll_keywords text[] not null default '{}';

comment on column public.video_jobs.use_broll is
  '実写Bロール背景を使うか（ワーカーに PEXELS_API_KEY 設定時のみ有効。未設定なら静止画にフォールバック）';
comment on column public.video_jobs.broll_keywords is
  'Bロール検索キーワード（英語推奨）。空なら theme を使用する';
