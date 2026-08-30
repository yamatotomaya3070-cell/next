-- =============================================================
-- 00019: 作業手順の学習ルール（manual_guidelines）
-- 提案版 v1 — 適用前にレビューしてください
--
-- 前提: 00001/00002（profiles, is_staff, set_updated_at）に依存。
--
-- 目的:
--   就労者向け「作業手順（manualSteps）」で見つかった不備を、
--   「直した内容(rule)」だけでなく「なぜ直すのか(reason)」ごと蓄積し、
--   以後のAI手順生成プロンプトに自動注入して同じ間違いを繰り返さないようにする。
--   毎回手で直す手間を減らし、AIが継続的に賢くなる「学習DB」として機能させる。
--
-- 使い方（配線）:
--   - src/lib/actions/manualSteps.ts の buildManualGuidelinesContext() が
--     is_active=true の行を整形し、createTaskWithAi → generateTask に注入する。
--   - 手順を修正した職員が「この修正を学習させる」導線から1行追加する。
--
-- scene_generation_notes(00018) が「SCENE生成(台本・TTS)」向けなのに対し、
-- 本テーブルは「作業手順(manualSteps)」向け。用途を分けて混線を防ぐ。
-- =============================================================

create table manual_guidelines (
  id uuid primary key default gen_random_uuid(),
  -- 短い要約（一覧・見出し用）。例:「完成見本を見る手順を書かない」
  title text not null,
  -- 守るべきルール（AIへの指示。例:「就労者は完成見本を見られないので、
  --   手順に『完成見本を見て』『完成見本と見くらべて』と書かない」）
  rule text not null,
  -- なぜ（根拠。これが無いと学習DBとして機能しない。例:「完成見本は答えなので
  --   利用者には非公開(スタッフ専用)。見せられない物を参照する手順は矛盾する」）
  reason text not null,
  -- 具体例（任意）。修正前=やりがちなNG例 / 修正後=あるべき書き方
  example_before text,
  example_after text,
  -- 対象スキル（tasks.skill_tags と同じ語彙）。空=全案件に適用
  skill_tags text[] not null default '{}',
  is_active boolean not null default true,
  -- どの案件の修正から学んだか（任意。振り返り用）
  source_task_id uuid references tasks (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_manual_guidelines_active on manual_guidelines (is_active, created_at);
create index idx_manual_guidelines_skill_tags on manual_guidelines using gin (skill_tags);

create trigger trg_manual_guidelines_updated before update on manual_guidelines
  for each row execute function set_updated_at();

alter table manual_guidelines enable row level security;

create policy "職員のみ手順ルールを管理" on manual_guidelines
  for all using (is_staff()) with check (is_staff());

-- 初期ルール: 今回の「完成見本」矛盾から得た教訓を最初から学習させておく。
insert into manual_guidelines (title, rule, reason, example_before, example_after)
values (
  '完成見本を見る手順を書かない',
  '就労者は完成見本(sample)を見られないので、作業手順に「完成見本を1回見て」「完成見本と見くらべて」など、完成見本を参照・視聴させる記述を入れないこと。作るゴールや確認は「依頼書」「タイミング表(編集指示書)」「納品前チェックリスト」を基準に書く。',
  '完成見本は答えなので利用者には非公開(スタッフ専用)。見せていない物を「見て確認」と指示する手順は矛盾し、就労者が実行できない。',
  '「完成見本」を1回見て、作るゴールを確認します。／ 全部置けたら、完成見本と見くらべて、大きな違いがないか確認します。',
  '依頼書とタイミング表で、作るゴール(順番・字幕・テロップ)を確認します。／ 全部置けたら、依頼書・タイミング表・チェックリストのとおりになっているか確認します。'
);
