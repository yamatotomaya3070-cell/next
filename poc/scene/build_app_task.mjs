// 素材一覧.json（build_materials の manifest）→ アプリの task_materials 用ペイロード app_task.json を生成。
//   request_doc(依頼書) / manual(steps[]=StepViewer) / revision_note(タイムライン表) / checklist(JSON) を SCENE から機械生成。
//   使い方: node poc/scene/build_app_task.mjs [パッケージフォルダ]
import { readFileSync, writeFileSync } from 'node:fs';
import { fmt } from './timing.mjs';

const DIR = process.argv[2] || 'poc/scene/out/就労者パッケージ_新NISA';
const M = JSON.parse(readFileSync(`${DIR}/素材一覧.json`, 'utf8'));
const SECTION_JA = { hook: '導入', problem: '問題提起', basics: '基礎説明', example: '具体例', dialogue: '疑問と誤解', caution: '注意点', summary: 'まとめ', cta: 'はじめ方' };
const totalMin = (M.totalSec / 60).toFixed(1);

// --- 依頼書（request_doc） ---
const requestDoc = `## お仕事の依頼書

お世話になります。金融解説のYouTube動画の編集をお願いします。

### 動画について
- タイトル: ${M.title}
- ジャンル: 横型（16:9）のYouTube解説動画（ハル・ミナ先生が会話で解説します）
- 長さ: 約${totalMin}分
- 仕様: ${M.spec.width}×${M.spec.height} / ${M.spec.fps}fps / ${M.spec.format}
- ファイル名: 「nisa_名前.mp4」

### 使う道具
- DaVinci Resolve（無料版）を使います。

### 編集ルール
- 支給音声を「タイミング表」の順番どおりに配置する
- セリフと同じ字幕を、話す人ごとに色を変えて画面下に入れる（ナレ=グレー / ハル=青 / ミナ先生=緑）
- 各シーンの図解を画面いっぱいに置く
- 強調テロップを、指示のあるシーンに入れる
- BGMを低音量で全体に流す

### 注意事項
- 支給素材以外の画像や音楽は使わないでください
- 数字や制度（税率・非課税枠など）は支給素材（音声・タイミング表）のとおりに。内容は変えないでください
- わからないことがあれば、遠慮なく質問してください`;

// --- 手順書（manual steps[] = StepViewer） ---
const steps = [
  { text: '依頼書と、この手順を最後まで読みます。', tip: 'わからない言葉は質問してください。' },
  { text: '依頼書とタイミング表で、どんな動画にするかを確認します。', tip: '依頼書の順番・字幕・テロップが作るゴールです。' },
  { text: '「支給素材一式」をダウンロードして、フォルダに展開します。', tip: '音声・図解・立ち絵・BGM・タイミング表が入っています。' },
  { text: `DaVinci Resolve を開き、新しいプロジェクトを作ります。解像度を ${M.spec.width}x${M.spec.height}、フレームレートを ${M.spec.fps} に設定します。`, tip: '右下の歯車（プロジェクト設定）で変えられます。' },
  { text: '「素材」フォルダの中身（音声・図解・立ち絵・BGM）を、メディアプールに全部読み込みます。', tip: 'メディアプールで右クリック→Import Media。' },
  { text: 'まず「音声」を、タイミング表の「開始」の時間どおりに A1トラックに並べます。', tip: `最初の ${fmt(M.titleIntroSec)} はタイトルの間です。音声を先に置くと後がラクです。` },
  { text: 'BGMを A2トラックに置き、最後まで伸ばして、音量を −20dB くらいに下げます。', tip: '声よりBGMを小さくします。' },
];
M.scenes.forEach((s) => {
  const isConv = s.type === 'character_conversation';
  const place = isConv
    ? `会話背景を置き、話している人の立ち絵を大きく、聞いている人を小さく置きます。話者が変わったら立ち絵を切り替えます。`
    : `図解「${s.figure.split('/').pop()}」を画面いっぱいに置きます。`;
  const tel = s.telops && s.telops.length ? ` 強調テロップ：${s.telops.map((t) => `「${t}」`).join('・')}。` : '';
  steps.push({
    text: `シーン${s.no}（${SECTION_JA[s.section] || s.section}・${fmt(s.startAbs)}〜）：${place} 音声に合わせてセリフ字幕（話者の色）を入れます。${tel}`,
    tip: `このシーンの音声は ${s.lines.length} 個。字幕はセリフと同じ言葉にします。`,
  });
});
steps.push({ text: '全部置けたら、依頼書とタイミング表のとおりになっているか確認します。', tip: 'ズレていたら音声の位置を直します。' });
steps.push({ text: 'Deliverページで書き出します。Format=MP4 / Codec=H.264 / 解像度そのまま。', tip: 'ファイル名は「nisa_名前.mp4」。' });

// --- 編集指示書（タイムライン表・revision_note） ---
const rows = [];
M.scenes.forEach((s) => {
  s.lines.forEach((l, i) => {
    const screen = i === 0
      ? (s.type === 'character_conversation' ? '会話（立ち絵）' : (s.figure.split('/').pop() || '')) + (s.telops?.length ? ` ／ テロップ:${s.telops.join('・')}` : '')
      : '';
    rows.push(`| ${fmt(l.startAbs)} | ${l.speakerJa} | ${l.audio.split('/').pop()} | ${l.text.replace(/\|/g, '／')} | ${screen} |`);
  });
});
const timelineMd = `## 編集指示書（タイムライン順）

タイミング表のとおりに、上から順番に編集してください。

| 時間 | 話者 | 使う音声 | セリフ（字幕） | 画面表示 |
|---|---|---|---|---|
${rows.join('\n')}`;

// --- 納品前チェックリスト（JSON文字列） ---
const checklist = [
  'すべてのセリフに字幕が付いている（話者の色分けも）',
  '図解・立ち絵が音声とズレていない',
  '強調テロップが指示のシーンに入っている',
  'BGMが声のじゃまになっていない（小さめ）',
  '依頼書・タイミング表のとおりに仕上がっている',
  `書き出した動画が ${M.spec.width}x${M.spec.height} / ${M.spec.fps}fps になっている`,
];

const payload = {
  task: {
    title: M.title,
    summary: '新NISAの非課税の仕組みを、ハル・ミナ先生の会話でやさしく解説する横型のYouTube解説動画です。支給素材と手順書を使って動画に仕上げます。',
    difficulty: 3,
    skill_tags: ['cut', 'telop', 'bgm', 'figure', 'duration', 'export'],
    estimated_minutes: 90,
    due_in_days: 5,
  },
  requestDoc,
  steps,
  timelineMd,
  checklist,
  spec: M.spec,
};
writeFileSync(`${DIR}/app_task.json`, JSON.stringify(payload, null, 2), 'utf8');
console.log(`=== app_task.json 生成: steps ${steps.length} / タイムライン ${rows.length}行 / チェック ${checklist.length}項目 ===`);
