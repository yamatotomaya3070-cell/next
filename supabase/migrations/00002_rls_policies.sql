-- =============================================================
-- RLS（行レベルセキュリティ）ポリシー
-- 原則: 利用者は自分のデータのみ / 職員(staff, admin)は全件
-- =============================================================

-- 職員判定ヘルパー（RLS内での profiles 再帰参照を避けるため security definer）
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

alter table profiles         enable row level security;
alter table tasks            enable row level security;
alter table task_materials   enable row level security;
alter table task_assignments enable row level security;
alter table submissions      enable row level security;
alter table feedback         enable row level security;
alter table progress_logs    enable row level security;
alter table user_aptitudes   enable row level security;
alter table qa_logs          enable row level security;
alter table knowledge_base   enable row level security;

-- ---------- profiles ----------
create policy "本人は自分のプロフィールを閲覧" on profiles
  for select using (id = auth.uid() or is_staff());
create policy "本人は表示設定を更新" on profiles
  for update using (id = auth.uid() or is_staff());
create policy "職員はプロフィール作成" on profiles
  for insert with check (is_staff() or id = auth.uid());

-- ---------- tasks ----------
-- 利用者: 自分に割当済み かつ published のみ閲覧
create policy "利用者は割当済み公開課題を閲覧" on tasks
  for select using (
    is_staff()
    or (
      status = 'published'
      and exists (
        select 1 from task_assignments a
        where a.task_id = tasks.id and a.user_id = auth.uid()
      )
    )
  );
create policy "職員は課題を管理" on tasks
  for all using (is_staff()) with check (is_staff());

-- ---------- task_materials ----------
-- 利用者: 承認済み教材のみ（割当済み課題に限る）
create policy "利用者は承認済み教材を閲覧" on task_materials
  for select using (
    is_staff()
    or (
      is_approved
      and exists (
        select 1 from task_assignments a
        where a.task_id = task_materials.task_id and a.user_id = auth.uid()
      )
    )
  );
create policy "職員は教材を管理" on task_materials
  for all using (is_staff()) with check (is_staff());

-- ---------- task_assignments ----------
create policy "利用者は自分の割当を閲覧" on task_assignments
  for select using (user_id = auth.uid() or is_staff());
create policy "利用者は自分の割当ステータスを更新" on task_assignments
  for update using (user_id = auth.uid() or is_staff());
create policy "職員は割当を管理" on task_assignments
  for insert with check (is_staff());
create policy "職員は割当を削除" on task_assignments
  for delete using (is_staff());

-- ---------- submissions ----------
create policy "利用者は自分の提出物を閲覧" on submissions
  for select using (
    is_staff()
    or exists (
      select 1 from task_assignments a
      where a.id = submissions.assignment_id and a.user_id = auth.uid()
    )
  );
create policy "利用者は自分の割当に提出" on submissions
  for insert with check (
    is_staff()
    or exists (
      select 1 from task_assignments a
      where a.id = submissions.assignment_id and a.user_id = auth.uid()
    )
  );

-- ---------- feedback ----------
-- 利用者: 承認済みフィードバックのみ閲覧（AI生の結果は職員承認後に開示）
create policy "利用者は承認済みフィードバックを閲覧" on feedback
  for select using (
    is_staff()
    or (
      status = 'approved'
      and exists (
        select 1
        from submissions s
        join task_assignments a on a.id = s.assignment_id
        where s.id = feedback.submission_id and a.user_id = auth.uid()
      )
    )
  );
create policy "職員はフィードバックを管理" on feedback
  for all using (is_staff()) with check (is_staff());

-- ---------- progress_logs ----------
create policy "利用者は自分の進捗ログを閲覧" on progress_logs
  for select using (user_id = auth.uid() or is_staff());
create policy "利用者は自分の進捗ログを記録" on progress_logs
  for insert with check (user_id = auth.uid() or is_staff());

-- ---------- user_aptitudes ----------
-- 適性記録は職員のみ（利用者本人にも非表示 — 職員の観察メモを含むため）
create policy "職員のみ適性記録を管理" on user_aptitudes
  for all using (is_staff()) with check (is_staff());

-- ---------- qa_logs ----------
create policy "利用者は自分の質問を閲覧" on qa_logs
  for select using (user_id = auth.uid() or is_staff());
create policy "利用者は質問を投稿" on qa_logs
  for insert with check (user_id = auth.uid() or is_staff());
create policy "職員は回答を記入" on qa_logs
  for update using (is_staff());

-- ---------- knowledge_base ----------
create policy "職員のみナレッジベースを管理" on knowledge_base
  for all using (is_staff()) with check (is_staff());

-- ---------- Storage: 提出物バケット ----------
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- パス規約: {user_id}/{assignment_id}/{filename}
create policy "利用者は自分のフォルダにアップロード" on storage.objects
  for insert with check (
    bucket_id = 'submissions'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_staff())
  );
create policy "利用者は自分の提出物を閲覧" on storage.objects
  for select using (
    bucket_id = 'submissions'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_staff())
  );

-- 教材用バケット（GIF/スクショ/見本。職員のみ書込、認証済み全員読取）
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

create policy "職員は教材をアップロード" on storage.objects
  for insert with check (bucket_id = 'materials' and is_staff());
create policy "認証済みユーザーは教材を閲覧" on storage.objects
  for select using (bucket_id = 'materials' and auth.uid() is not null);
