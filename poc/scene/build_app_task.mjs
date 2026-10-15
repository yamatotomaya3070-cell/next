// 素材一覧.json（build_materials の manifest）→ アプリの task_materials 用ペイロード app_task.json を生成。
//   request_doc(依頼書) / revision_note(作業指示一覧) / checklist(JSON) を SCENE から機械生成。
//   作業の手順は案件ごとに作らない（アプリの src/lib/guide/workflow.ts が全案件共通で持つ）。
//   使い方: node poc/scene/build_app_task.mjs [パッケージフォルダ]
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = process.argv[2] || 'poc/scene/out/就労者パッケージ_新NISA';
const M = JSON.parse(readFileSync(`${DIR}/素材一覧.json`, 'utf8'));
const SECTION_JA = { hook: '導入', problem: '問題提起', basics: '基礎説明', example: '具体例', dialogue: '疑問と誤解', caution: '注意点', summary: 'まとめ', cta: 'はじめ方' };
const totalMin = (M.totalSec / 60).toFixed(1);
// 提出ファイル名は英字にする（日本語名は提出時に文字化けしやすい）。題材によらず同じ決まり。
const fileName = 'video_名前.mp4';
const topic = M.theme || M.title;

// --- 依頼書（request_doc） ---
const requestDoc = `## お仕事の依頼書

お世話になります。金融解説のYouTube動画の編集をお願いします。

### 動画について
- タイトル: ${M.title}
- ジャンル: 横型（16:9）のYouTube解説動画（ハル・ミナ先生が会話で解説します）
- 使う道具: DaVinci Resolve（無料版）

### 納品のしかた
- 長さ: 約${totalMin}分（完成見本と同じ長さ）
- 大きさ: ${M.spec.width}×${M.spec.height} / ${M.spec.fps}fps / ${M.spec.format}（書き出しプリセット「絆_YouTube_720p」でこの形になります）
- ファイル名: 「${fileName}」
- 「提出」タブから送ります

作り方は「作業のしかた」タブに、上から順番に書いてあります。

### 注意事項
- 支給素材以外の画像や音楽は使わないでください
- 数字や制度（税率・非課税枠など）は支給素材（音声・作業指示一覧）のとおりに。内容は変えないでください
- わからないことがあれば、遠慮なく質問してください`;

const voiceCount = M.scenes.reduce((n, s) => n + s.lines.filter((l) => l.audio).length, 0);

// --- 編集指示書（作業指示一覧・revision_note） ---
const rows = [];
M.scenes.forEach((s) => {
  // 強調テロップは会話の場面だけ・2つ目のセリフの頭から場面の終わりまで（build_materials と同じ決まり）。
  // 図解の場面は映像に文字が入っているので空欄。映像や図解のファイル名は、自動で並ぶので書かない。
  const telop = s.overlayTelop ?? '';
  const telopRow = s.lines.length > 1 ? 1 : 0;
  s.lines.forEach((l, i) => {
    const cell = telop && i === telopRow ? `「${telop}」ここから場面の終わりまで` : '';
    // 手で並べるときの目安。「絆_素材を並べる」もこの位置に置く（build_materials と同じ式）
    const gap = l.gapF === undefined ? '' : i === 0 ? `場面の頭から${l.gapF}` : `${l.gapF}`;
    rows.push(`| ${s.no}-${i + 1} | ${l.speakerJa} | ${l.audio.split('/').pop()} | ${l.text.replace(/\|/g, '／')} | ${cell} | ${gap} | ${l.startTc ?? ''} |`);
  });
});
const timelineMd = `## 作業指示一覧

字幕に入れる文と、強調テロップを入れる場所の一覧です。字幕はここから文をコピーして貼ってください。
強調テロップは、「強調テロップ」の欄に文字がある行だけに入れます。
「空ける間」と「置く位置」は、セリフの音声を手で並べ直すときに使います（［絆_素材を並べる］を使えば、この位置に自動で並びます）。
空ける間は、前のセリフの終わりから空けるフレーム数です（場面の最初のセリフは、場面の映像の頭から数えます）。

| 順番 | 話す人 | 使う音声 | セリフ（字幕の文） | 強調テロップ | 空ける間（フレーム） | 置く位置 |
|---|---|---|---|---|---|---|
${rows.join('\n')}`;

// --- 納品前チェックリスト（JSON文字列） ---
const checklist = [
  `セリフ${voiceCount}本すべてに字幕が付き、話す人の型（ナレーション／ハル／ミナ先生）が合っている`,
  '字幕の文が作業指示一覧と同じで、字幕の長さがその声と合っている',
  '強調テロップが指示のシーンに入っている',
  'BGMが声のじゃまになっていない（小さめ）',
  'BGMの音量を -20 にした',
  `書き出した動画が ${M.spec.width}x${M.spec.height} / ${M.spec.fps}fps になっている`,
];

const payload = {
  task: {
    title: M.title,
    summary: `「${topic}」を、ハル・ミナ先生の会話でやさしく解説する横型のYouTube解説動画です。支給素材を使い、「作業のしかた」のとおりに動画に仕上げます。`,
    difficulty: 3,
    skill_tags: ['cut', 'telop', 'bgm', 'figure', 'duration', 'export'],
    estimated_minutes: 90,
    due_in_days: 5,
  },
  requestDoc,
  timelineMd,
  checklist,
  spec: M.spec,
};
writeFileSync(`${DIR}/app_task.json`, JSON.stringify(payload, null, 2), 'utf8');
console.log(`=== app_task.json 生成: 作業指示 ${rows.length}行 / チェック ${checklist.length}項目 ===`);
