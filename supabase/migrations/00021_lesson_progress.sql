-- =============================================================
-- 00021: 教科書のレッスンの進み具合
--
-- 前提: 00001/00002（profiles, is_staff）に依存。
--
-- 目的:
--   教科書（src/lib/guide/lessons）は段0〜段4の一本道。利用者が「できた」を押したレッスンを残し、
--   次にどこから始めるかを出す。事業所のパソコンは共用のことがあるので、ブラウザではなく DB に置く。
--   職員は利用者ごとに、どこまで進んだかを見られる。
--
-- 設計メモ:
--   - lesson_slug はアプリのレッスンの slug（"cut-basics" など）。レッスンはコードにあるので外部キーは張らない。
--   - 1人1レッスン1行。「できた」を取り消すと行を消す。
-- =============================================================

create table lesson_progress (
  user_id uuid not null references profiles (id) on delete cascade,
  lesson_slug text not null check (lesson_slug ~ '^[a-z0-9-]{1,64}$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);

alter table lesson_progress enable row level security;

create policy "本人と職員は進み具合を閲覧" on lesson_progress
  for select using (user_id = auth.uid() or is_staff());

create policy "本人は自分の進み具合を記録" on lesson_progress
  for insert with check (user_id = auth.uid());

create policy "本人は自分の進み具合を取り消す" on lesson_progress
  for delete using (user_id = auth.uid());
