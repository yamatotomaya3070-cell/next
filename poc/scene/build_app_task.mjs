// 素材一覧.json（build_materials の manifest）→ アプリの task_materials 用ペイロード app_task.json を生成。
//   request_doc(依頼書) / manual(steps[]=StepViewer) / revision_note(作業指示一覧) / checklist(JSON) を SCENE から機械生成。
//   使い方: node poc/scene/build_app_task.mjs [パッケージフォルダ]
import { readFileSync, writeFileSync } from 'node:fs';

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
- 素材は「素材」フォルダごとメディアプールに入れ、［絆_素材を並べる］でタイムラインに並べる
- セリフと同じ字幕を画面下に入れる。話す人ごとの字幕の型（ナレーション／ハル／ミナ先生）を使う
- 強調テロップは、作業指示一覧に文字がある場面だけに入れる
- BGMは声がはっきり聞こえる音量まで下げる（-20dBが目安。完成見本と聞きくらべる）
- 書き出しはプリセット「絆_YouTube_720p」を使う

### 注意事項
- 支給素材以外の画像や音楽は使わないでください
- 数字や制度（税率・非課税枠など）は支給素材（音声・作業指示一覧）のとおりに。内容は変えないでください
- わからないことがあれば、遠慮なく質問してください`;

// --- 手順書（manual steps[] = StepViewer） ---
// どの動画でも同じ流れ。操作のくわしいやり方は、アプリ内の「動画編集の教科書」(guide) に任せて手順は短く保つ。
const voiceCount = M.scenes.reduce((n, s) => n + s.lines.filter((l) => l.audio).length, 0);
const telopScenes = M.scenes
  .map((s) => ({ no: s.no, text: s.overlayTelop !== undefined ? s.overlayTelop : (s.telops || [])[0] }))
  .filter((t) => t.text);
const telopList = telopScenes.map((t) => `S${t.no}「${t.text}」`).join('、');
const steps = [
  { text: '依頼書と作業指示一覧を読み、完成見本を最後まで見て、どんな動画にするか確認します。', tip: 'わからない言葉は質問してください。', guide: null },
  { text: '「支給素材一式」をダウンロードして、フォルダに展開します。', tip: '音声・映像・BGM・作業指示一覧が入っています。', guide: null },
  { text: 'DaVinci Resolve で新しいプロジェクトを作ります。名前は「動画の名前_自分の名前」にします。', tip: '画面の大きさなどの設定は、次の［絆_素材を並べる］で自動で入ります。', guide: 'project#new' },
  { text: '「素材」フォルダの中のフォルダを全部えらんで、メディアプールへドラッグして入れます。', tip: '右クリックの［メディアの読み込み］は使いません。', guide: 'import#drag' },
  { text: '上のメニュー［ワークスペース］→［スクリプト］→［絆_素材を並べる］を押して、素材を並べます。', tip: `30秒ほどで、オープニング・場面の映像${M.scenes.length}本・セリフ${voiceCount}本・BGM・エンディングが並び、ビューアに「並べ終わりました。」と出ます。`, guide: 'arrange#auto' },
  { text: 'BGMを全部えらんで、声がはっきり聞こえる音量まで下げます。', tip: '-20 が目安です。完成見本と聞きくらべてください。', guide: 'audio#volume' },
  { text: `セリフ1本ごとに字幕を入れます（全部で${voiceCount}本）。話す人の字幕の型を V3 に置き、長さを音声に合わせ、作業指示一覧のセリフを貼ります。`, tip: '使う型は、音声ファイル名の最後に書いてある人です。こまめに Ctrl + S で保存します。', guide: 'subtitles#place' },
  telopScenes.length > 0
    ? { text: `強調テロップを入れます（${telopList}）。作業指示一覧に文字がある場面だけです。`, tip: '2つ目のセリフの頭から、その場面の終わりまで表示します。', guide: 'telop#place' }
    : { text: '強調テロップはこの動画にはありません。', tip: '作業指示一覧の強調テロップの欄が空いている場面には入れません。', guide: 'telop#place' },
  { text: 'デリバーで、プリセット「絆_YouTube_720p」をえらんで書き出します。ファイル名は「nisa_名前.mp4」です。', tip: '保存してから書き出します。', guide: 'export#preset' },
  { text: '書き出した動画を最初から最後まで見て、完成見本とくらべます。', tip: '映像の順番、字幕の文と色、テロップ、声とBGMの大きさを確認します。', guide: 'export#check' },
  { text: '「提出」タブから動画を提出します。', tip: '提出したら、結果が届くまで待ちます。', guide: null },
];

// --- 編集指示書（作業指示一覧・revision_note） ---
const rows = [];
M.scenes.forEach((s) => {
  s.lines.forEach((l, i) => {
    const screen = i === 0
      ? (s.figure.split('/').pop() || '') + ((s.overlayTelop ?? s.telops?.[0]) ? ` ／ テロップ:${s.overlayTelop ?? s.telops[0]}` : '')
      : '';
  rows.push(`| ${s.no}-${s.lines.indexOf(l) + 1} | ${l.speakerJa} | ${l.audio.split('/').pop()} | ${l.text.replace(/\|/g, '／')} | ${screen} |`);
  });
});
const timelineMd = `## 編集指示書（作業順）

作業指示一覧のとおりに、上から順番に編集してください。細かな開始・終了秒数へ合わせる必要はありません。

| 順番 | 演者 | 使う音声 | セリフ（字幕） | 画面表示 |
|---|---|---|---|---|
${rows.join('\n')}`;

// --- 納品前チェックリスト（JSON文字列） ---
const checklist = [
  'すべてのセリフに字幕が付き、本文色と話者名・帯の色分けが見本と一致している',
  '図解・立ち絵が音声とズレていない',
  '強調テロップが指示のシーンに入っている',
  'BGMが声のじゃまになっていない（小さめ）',
  '依頼書・作業指示一覧の順番どおりに仕上がっている',
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
console.log(`=== app_task.json 生成: steps ${steps.length} / 作業指示 ${rows.length}行 / チェック ${checklist.length}項目 ===`);
