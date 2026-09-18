-- =============================================================
-- 00020: メッセージ（利用者 ⇄ 職員 のチャット）
--
-- 前提: 00001/00002（profiles, task_assignments, qa_logs, is_staff）に依存。
--
-- 目的:
--   これまでの qa_logs は「質問1件に回答1件」の構造で、LINEのような
--   やりとり（往復・複数回の返信・職員からの先出し連絡）を表現できなかった。
--   本テーブルは「1行 = 1発言」。利用者ごとに1つのトーク（trainee_id）を持ち、
--   利用者と職員のどちらからでも発言できる。
--
-- 設計メモ:
--   - sender_name は送信時点の表示名のスナップショット。
--     profiles の RLS では利用者が職員の名前を読めないため、非正規化して持つ。
--   - read_at は「相手側が読んだ時刻」。自分の吹き出しに「既読」を出すために使う。
--   - 既存の qa_logs は削除せず、内容を本テーブルへ取り込む（質問→利用者の発言、
--     回答→職員/AIの発言）。取り込み後、アプリは qa_logs に書かなくなる。
--   - Realtime（postgres_changes）で新着を即時反映するため publication に追加する。
-- =============================================================

create table messages (
  id uuid primary key default gen_random_uuid(),
  -- トークの持ち主（利用者）。職員はこの id でルームを切り替える
  trainee_id uuid not null references profiles (id) on delete cascade,
  -- 発言者。AI由来の取り込み行は null
  sender_id uuid references profiles (id) on delete set null,
  sender_kind text not null check (sender_kind in ('trainee', 'staff', 'ai')),
  sender_name text not null,
  -- どの案件についての発言か（任意）
  assignment_id uuid references task_assignments (id) on delete set null,
  body text not null check (length(btrim(body)) > 0),
  -- 相手側が読んだ時刻（未読なら null）
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_room on messages (trainee_id, created_at);
create index idx_messages_unread on messages (trainee_id, sender_kind)
  where read_at is null;

alter table messages enable row level security;

-- 閲覧: 本人のトーク or 職員
create policy "利用者は自分のトークを閲覧" on messages
  for select using (trainee_id = auth.uid() or is_staff());

-- 投稿: 利用者は自分のトークに自分名義で／職員はどのトークにも職員名義で
create policy "利用者は自分のトークに投稿" on messages
  for insert with check (
    (trainee_id = auth.uid() and sender_id = auth.uid() and sender_kind = 'trainee')
    or (is_staff() and sender_id = auth.uid() and sender_kind = 'staff')
  );

-- 既読更新: 本人のトーク or 職員（相手の発言に read_at を付ける）
create policy "既読を記録" on messages
  for update using (trainee_id = auth.uid() or is_staff())
  with check (trainee_id = auth.uid() or is_staff());

-- 既読の更新で書き換えてよい列は read_at だけ（本文や送信者を後から書き換えられないようにする）
revoke update on table messages from authenticated;
grant update (read_at) on table messages to authenticated;

-- Realtime で新着を配信（RLS は select ポリシーがそのまま効く）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- 既存の質問/回答（qa_logs）をチャット形式へ取り込む
insert into messages (trainee_id, sender_id, sender_kind, sender_name, assignment_id, body, read_at, created_at)
select
  q.user_id,
  q.user_id,
  'trainee',
  coalesce(p.display_name, '利用者'),
  q.assignment_id,
  q.question,
  -- 回答済みの質問は職員が読んだものとして扱う
  q.answered_at,
  q.created_at
from qa_logs q
left join profiles p on p.id = q.user_id
where length(btrim(q.question)) > 0;

insert into messages (trainee_id, sender_id, sender_kind, sender_name, assignment_id, body, read_at, created_at)
select
  q.user_id,
  null,
  case when q.answered_by = 'ai' then 'ai' else 'staff' end,
  case when q.answered_by = 'ai' then '作業サポートAI' else 'スタッフ' end,
  q.assignment_id,
  q.answer,
  -- 過去の回答は利用者が既に見たものとして扱う（未読バッジを付けない）
  coalesce(q.answered_at, q.created_at + interval '1 second'),
  coalesce(q.answered_at, q.created_at + interval '1 second')
from qa_logs q
where q.answer is not null and length(btrim(q.answer)) > 0;
