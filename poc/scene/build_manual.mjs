// 素材一覧.json（build_materials.mjs の出力）→ DaVinci Resolve 用の「手順書.md」を自動生成。
//   操作単位の共通手順＋シーン別「作業カード」（何を置くか・字幕・テロップ・タイムコード）を出す。
//   使い方: node poc/scene/build_manual.mjs [パッケージフォルダ]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fmt } from './timing.mjs';

const DIR = process.argv[2] || 'poc/scene/out/就労者パッケージ_新NISA';
const M = JSON.parse(readFileSync(`${DIR}/素材一覧.json`, 'utf8'));

const SPEAKER_COLOR = { ナレーション: 'グレー', ハル: '青', ミナ先生: '緑' };
const EXPR_JA = { neutral: 'ふつう', curious: '興味', surprised: '驚き', worried: '不安', thinking: '考え中', understood: '納得', happy: '笑顔',
  explaining: '説明', pointing: '指さし', caution: '注意', reassuring: '安心', positive: '前向き' };
const speakerJa = (l) => l.speakerJa;
const exprLabel = (expr) => { if (!expr) return ''; const [, e] = expr.split('_'); return EXPR_JA[e] || e; };

function card(s) {
  const out = [];
  out.push(`### S${s.no}　${sectionJa(s.section)}（${s.typeJa}）　${fmt(s.startAbs)} 〜 ${fmt(s.endAbs)}`);
  out.push('');
  // 画面に置くもの
  if (s.type === 'character_conversation') {
    out.push(`**① 背景と立ち絵**`);
    out.push(`- 背景：\`${s.figure}\` をいちばん下に置く`);
    out.push(`- 立ち絵：話している人を大きく手前・聞いている人は少し小さめ。話者が変わるたびに立ち絵を切り替える（下の表の「立ち絵」列）`);
  } else {
    out.push(`**① 図解（画面いっぱいに置く）**`);
    out.push(`- \`${s.figure}\``);
  }
  out.push('');
  // 音声＋セリフ字幕
  out.push(`**② 音声を置いて、同じ言葉のセリフ字幕を入れる**（字幕の色：話者ごとに変える）`);
  if (s.lines.length) {
    out.push('');
    out.push('| # | 開始 | 話者(字幕色) | 立ち絵 | 音声ファイル | セリフ字幕（画面下に出す） |');
    out.push('|---|---|---|---|---|---|');
    s.lines.forEach((l, i) => {
      const color = SPEAKER_COLOR[speakerJa(l)] || '';
      const expr = l.expr ? `${l.expr}（${exprLabel(l.expr)}）` : '—';
      out.push(`| ${i + 1} | ${fmt(l.startAbs)} | ${speakerJa(l)}（${color}） | ${expr} | \`${l.audio.replace('素材/音声/', '')}\` | 「${l.text}」 |`);
    });
  } else {
    out.push('- （このシーンにセリフはありません）');
  }
  out.push('');
  // 強調テロップ
  if (s.telops && s.telops.length) {
    out.push(`**③ 強調テロップ（画面の中央より少し上に、大きく）**`);
    s.telops.forEach((t) => out.push(`- 「${t}」`));
    out.push('');
  }
  if (s.editNote) { out.push(`> 🎬 演出のヒント：${s.editNote}`); out.push(''); }
  return out.join('\n');
}

const SECTION_JA = { hook: '導入・フック', problem: '問題提起', basics: '基礎説明', example: '具体例', dialogue: '疑問と誤解', caution: '注意点', summary: 'まとめ', cta: 'はじめ方・行動喚起' };
const sectionJa = (s) => SECTION_JA[s] || s;

const totalMin = (M.totalSec / 60).toFixed(1);
const doc = `# 動画編集 手順書（DaVinci Resolve 用）

**動画タイトル：${M.title}**

この手順書は、同じフォルダの「素材」を使って、**依頼書とタイミング表のとおりに動画を自分で作る**ための手順です。
上から順番にやれば完成します。わからない言葉が出てきたら、支援員さんに聞いてください。

---

## 0. 準備するもの

- **DaVinci Resolve（無料版）** … パソコンにインストールしておく（無料でダウンロードできます）
- **このフォルダ一式**（手順書.md／タイミング表.csv／素材フォルダ）
- 作る動画の形：**依頼書とタイミング表**で、どんな動画にするか確認しましょう。

**動画の仕様**：${M.spec.width}×${M.spec.height} ／ ${M.spec.fps}fps ／ ${M.spec.format} ／ 長さ 約${totalMin}分

---

## 1. 全体の流れ（この順番でやります）

1. DaVinci で新しいプロジェクトを作る（仕様を合わせる）
2. 素材（音声・図解・立ち絵・BGM）をぜんぶ読み込む
3. **まず音声を、タイミング表のとおりに並べる**（これが動画の骨組みになります）
4. BGM を下に敷いて、音を小さくする
5. 各シーンの図解・立ち絵を、音声に合わせて置く
6. セリフ字幕を入れる（話している言葉と同じ）
7. 強調テロップを入れる
8. 書き出す（Deliver）

> 💡 コツ：**音声を先に置く**と、あとの図解や字幕を「音に合わせるだけ」で済むのでラクです。

---

## 2. 共通の操作

### 2-1. 新しいプロジェクトとタイムライン
1. DaVinci を開き、「新規プロジェクト」→ 名前を付ける。
2. 右下の歯車（プロジェクト設定）→ タイムライン解像度 **${M.spec.width} x ${M.spec.height}**、タイムラインフレームレート **${M.spec.fps}**。
3. 「Edit（エディット）」ページを開く。

### 2-2. 素材の読み込み
1. 左上の「Media Pool（メディアプール）」で右クリック →「Import Media」。
2. \`素材\` フォルダの中（音声・図解・立ち絵・BGM）を**全部**読み込む。

### 2-3. 音声を並べる（骨組み）
- 「タイミング表.csv」（Excelで開けます）の **開始（絶対）** の時間を見ながら、音声ファイルを **オーディオトラック A1** に置いていきます。
- 先頭は **${fmt(M.titleIntroSec)} 付近から**始まります（最初の${M.titleIntroSec}秒はタイトルの間）。

### 2-4. BGM を敷く
- \`${M.assets.bgm || '素材/BGM/BGM.wav'}\` を **オーディオトラック A2** に置き、動画の最後まで伸ばす（足りなければコピーして繋ぐ）。
- BGM のクリップを選び、音量を **−20dB くらい**まで下げる（声より小さく）。

### 2-5. 図解・立ち絵を置く
- 各シーンの図解PNGを **ビデオトラック V1**、立ち絵PNGを **V2** に置き、そのシーンの音声と**長さをそろえる**。

### 2-6. 字幕・テロップを入れる
- 上のメニュー「Effects → Titles → **Text+**」をタイムラインの **V3以上**にドラッグ。
- **セリフ字幕**：画面の下。話者ごとに文字の色を変える（${Object.entries(SPEAKER_COLOR).map(([k, v]) => `${k}=${v}`).join(' / ')}）。
- **強調テロップ**：画面の中央より少し上に、大きく。

### 2-7. 書き出し（Deliver）
1. 下の「Deliver（デリバー）」ページを開く。
2. Format = **MP4**、Codec = **H.264**、解像度 **${M.spec.width}x${M.spec.height}**、フレームレート **${M.spec.fps}**。
3. 「Add to Render Queue」→「Render All」。

---

## 3. シーン別 作業カード（この通りに置けば完成します）

各シーンの「開始〜終了」はタイミング表の絶対時間です。まず②の音声を置いてから、①の絵・③のテロップを乗せます。

${M.scenes.map(card).join('\n---\n\n')}

---

## 4. 仕上げチェック

- [ ] すべてのセリフに字幕が付いている（話者の色分けも）
- [ ] 図解・立ち絵が音声とズレていない
- [ ] 強調テロップが各シーンに入っている
- [ ] BGM が声の邪魔をしていない（小さめ）
- [ ] 依頼書・タイミング表のとおりに仕上がっている
- [ ] 書き出した動画が ${M.spec.width}x${M.spec.height} / ${M.spec.fps}fps になっている

> 数字や制度（税率・非課税枠など）は支給素材（音声・タイミング表）のとおりに入れてください。内容を勝手に変えないこと。
`;

writeFileSync(`${DIR}/手順書.md`, doc, 'utf8');
console.log(`=== 手順書生成: ${DIR}/手順書.md （${M.scenes.length}シーンの作業カード） ===`);
if (!existsSync(`${DIR}/完成見本.mp4`)) console.log('  ⚠ 完成見本.mp4 が見つかりません');
