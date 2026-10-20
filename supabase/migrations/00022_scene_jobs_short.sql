-- =============================================================
-- 00022: 案件の長さを 1分から作れるようにする
--
-- 前提: 00017（scene_jobs）に依存。
--
-- 目的:
--   教科書の段3「組み合わせ」は 1分 → 3分 → 5分 の順に、全部の作業を1本の動画でやる。
--   今の制約（3〜15分）では 1分の案件が作れないので、下限を 1分にする。
--
-- 設計メモ:
--   - 00017 の制約は列に書いた check なので、名前は scene_jobs_target_minutes_check のはず。
--     名前がちがっていても古い制約が残らないよう、target_minutes を見ている check を全部消してから付け直す。
-- =============================================================

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.scene_jobs'::regclass
      and con.contype = 'c'
      and att.attname = 'target_minutes'
  loop
    execute format('alter table public.scene_jobs drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.scene_jobs add constraint scene_jobs_target_minutes_check check (target_minutes between 1 and 15);
