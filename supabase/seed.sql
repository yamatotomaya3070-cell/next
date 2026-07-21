-- =============================================================
-- 開発用シードデータ
-- 前提: Supabase Auth で以下の2ユーザーを事前作成しておくこと
--   職員:   staff@example.com   (user_metadata: {"role":"staff","display_name":"職員 太郎"})
--   利用者: trainee@example.com (user_metadata: {"role":"trainee","display_name":"利用者 花子"})
-- auth.users 作成時のトリガーで profiles は自動生成される。
-- 以下では既存 profiles の id を参照する。
-- =============================================================

do $$
declare
  v_staff uuid;
  v_trainee uuid;
  v_task uuid;
  v_assignment uuid;
begin
  select id into v_staff from profiles where role = 'staff' limit 1;
  select id into v_trainee from profiles where role = 'trainee' limit 1;

  if v_staff is null or v_trainee is null then
    raise notice 'staff / trainee ユーザーが未作成のためシードをスキップしました';
    return;
  end if;

  -- 練習課題 1: カット編集の基礎
  insert into tasks (type, status, title, summary, difficulty, skill_tags, estimated_minutes, due_in_days, created_by)
  values (
    'practice', 'published',
    '【練習】インタビュー動画のカット編集',
    '3分のインタビュー動画から、いらない部分を切って2分にまとめる練習です。',
    1, '{cut,export}', 60, 3, v_staff
  )
  returning id into v_task;

  insert into task_materials (task_id, kind, title, content, sort_order, generated_by, is_approved) values
  (v_task, 'request_doc', 'お仕事の依頼書（練習用）',
   E'## お仕事の内容《ないよう》\n\nインタビュー動画《どうが》を短《みじか》くまとめてください。\n\n- 完成《かんせい》の長《なが》さ: **2分**\n- いらない部分《ぶぶん》（言い間違《まちが》い・長い沈黙《ちんもく》）はカットする\n- 納期《のうき》: 3日後\n- 納品形式《のうひんけいしき》: MP4（1920x1080）',
   0, 'ai', true);

  insert into task_materials (task_id, kind, title, steps, sort_order, generated_by, is_approved) values
  (v_task, 'manual', 'カット編集のやり方',
   '[
     {"text": "編集《へんしゅう》ソフトを開《ひら》きます。", "tip": "デスクトップのアイコンをダブルクリックします。"},
     {"text": "素材《そざい》の動画《どうが》ファイルを読《よ》み込《こ》みます。", "tip": "ファイルをタイムラインにドラッグします。"},
     {"text": "動画を最初《さいしょ》から最後《さいご》まで一度《いちど》見ます。", "tip": "いらない部分をメモしておくと後で楽です。"},
     {"text": "いらない部分の始《はじ》まりでカットします。", "tip": "再生ヘッドを合わせてカットボタンを押します。"},
     {"text": "いらない部分の終《お》わりでもカットします。", "tip": null},
     {"text": "切り取った部分を削除《さくじょ》します。", "tip": "間違えたら「元に戻す」で戻せます。あわてなくて大丈夫です。"},
     {"text": "全体を見直《みなお》して、2分になっているか確認《かくにん》します。", "tip": "長さは画面の下に表示されます。"},
     {"text": "MP4形式《けいしき》で書き出《だ》します。", "tip": "書き出しには数分かかります。休憩してもOKです。"}
   ]'::jsonb,
   1, 'ai', true);

  -- 割当
  insert into task_assignments (task_id, user_id, status, due_at, assigned_by)
  values (v_task, v_trainee, 'not_started', now() + interval '3 days', v_staff)
  returning id into v_assignment;

  -- 練習課題 2: テロップ挿入（下書き状態 — 職員画面の確認用）
  insert into tasks (type, status, title, summary, difficulty, skill_tags, estimated_minutes, due_in_days, created_by)
  values (
    'practice', 'draft',
    '【練習】料理動画にテロップを入れる',
    '台本のとおりに字幕（テロップ）を入れる練習です。',
    2, '{telop,script}', 90, 5, v_staff
  );

  -- 適性記録サンプル
  insert into user_aptitudes (user_id, key, rating, note, recorded_by) values
  (v_trainee, 'pc_endurance', 4, '午前中は集中して作業できる。午後は休憩多めが良い。', v_staff),
  (v_trainee, 'asking_for_help', 2, '困っていても自分から声をかけにくい様子。定期的な声かけが必要。', v_staff);
end;
$$;
