// 素材一覧.json（build_materials.mjs の出力）→ DaVinci Resolve 用の「手順書.md」を自動生成。
//   操作単位の共通手順＋シーン別「作業カード」（何を置くか・字幕・テロップ）を出す。
//   使い方: node poc/scene/build_manual.mjs [パッケージフォルダ]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = process.argv[2] || 'poc/scene/out/就労者パッケージ_新NISA';
const M = JSON.parse(readFileSync(`${DIR}/素材一覧.json`, 'utf8'));

const SPEAKER_COLOR = { ナレーション: 'グレー', ハル: '青', ミナ先生: '緑' };
const EXPR_JA = { neutral: 'ふつう', curious: '興味', surprised: '驚き', worried: '不安', thinking: '考え中', understood: '納得', happy: '笑顔',
  explaining: '説明', pointing: '指さし', caution: '注意', reassuring: '安心', positive: '前向き' };
const speakerJa = (l) => l.speakerJa;
const exprLabel = (expr) => { if (!expr) return ''; const [, e] = expr.split('_'); return EXPR_JA[e] || e; };

function card(s) {
  const out = [];
  const hasAnimatedVisual = s.figure?.toLowerCase().endsWith('.mp4');
  out.push(`### S${s.no}　${sectionJa(s.section)}（${s.typeJa}）`);
  out.push('');
  // 画面に置くもの
  if (hasAnimatedVisual) {
    out.push(`**① アニメーション済み映像を置く**`);
    out.push(`- \`${s.figure}\` を V1 に置き、このシーンの音声全体と長さをそろえる`);
    out.push('- 人物・数字・グラフ・図形の動きは素材に入っています。画像の切り分けやアニメーションの作成は不要です');
    out.push('- 映像は縦横比を保ち、字幕と重ならない位置・大きさに調整する');
  } else if (s.type === 'character_conversation') {
    out.push(`**① 背景と立ち絵**`);
    out.push(`- 背景：\`${s.figure}\` をいちばん下に置く`);
    out.push(`- 立ち絵：話している人を大きく手前・聞いている人は少し小さめ。話者が変わるたびに立ち絵を切り替える（下の表の「立ち絵」列）`);
  } else {
    out.push(`**① 図解（字幕と重ならないサイズ・位置に置く）**`);
    out.push(`- \`${s.figure}\``);
    out.push('- 画像の縦横比を保ち、全体が見えるように配置する。引き伸ばしや、重要部分が切れる拡大はしない');
    out.push('- 画面下端から150pxを字幕用に空ける。1280×720素材はズーム79％を初期値とし、重要な文字や図が隠れない範囲で微調整する');
    out.push('- 左右に余白が出る場合は、画像を無理に引き伸ばさず、指定された背景を使用する');
  }
  out.push('');
  // 音声＋セリフ字幕
  out.push(`**② 音声を順番に置き、同じ言葉のセリフ字幕を入れる**`);
  if (s.lines.length) {
    out.push('');
    out.push('| 順番 | 演者 | 立ち絵 | 使用する音声素材名 | セリフ（画面下に字幕表示） |');
    out.push('|---|---|---|---|---|');
    s.lines.forEach((l, i) => {
      const expr = l.expr ? `${l.expr}（${exprLabel(l.expr)}）` : '—';
      out.push(`| ${i + 1} | ${speakerJa(l)} | ${expr} | \`${l.audio.replace('素材/音声/', '')}\` | 「${l.text}」 |`);
    });
  } else {
    out.push('- （このシーンにセリフはありません）');
  }
  out.push('');
  // 強調テロップ
  const overlay = s.overlayTelop !== undefined ? s.overlayTelop : (s.telops || [])[0];
  if (overlay) {
    out.push(`**③ 強調テロップ**`);
    out.push(`- 「${overlay}」（このシーンの2つ目のセリフの頭から、シーンの終わりまで）`);
    out.push('- Yu Gothic UI（なければメイリオ）、太字、46px相当、文字色 #08201D、背景色 #FCEEC0、高さ74px、横中央、上端150pxを基準に配置する');
    out.push('- アニメーションの指示がある場合だけ、0.35秒で表示し、続く0.4秒で90％から100％へ拡大する。指示がなければ静止表示にする');
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

この手順書は、同じフォルダの「素材」を使って、**作業指示一覧の上から順番に動画を作る**ための手順です。
上から順番にやれば完成します。わからない言葉が出てきたら、支援員さんに聞いてください。

---

## 0. 準備するもの

- **DaVinci Resolve（無料版）** … パソコンにインストールしておく（無料でダウンロードできます）
- **このフォルダ一式**（手順書.md／作業指示一覧.csv／素材フォルダ）
- 作る動画の形：**依頼書・作業指示一覧・完成見本**で、どんな動画にするか確認しましょう。

**動画の仕様**：${M.spec.width}×${M.spec.height} ／ ${M.spec.fps}fps ／ ${M.spec.format} ／ 長さ 約${totalMin}分

---

## 1. 全体の流れ（この順番でやります）

1. DaVinci で新しいプロジェクトを作る（仕様を合わせる）
2. 素材（音声・図解・立ち絵・BGM）をぜんぶ読み込む
3. **まず音声を、作業指示一覧の上から順番に並べる**（これが動画の骨組みになります）
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
- 「作業指示一覧.csv」（Excelで開けます）を上から確認し、音声ファイルを **オーディオトラック A1** に順番に置きます。
- 通常は前の音声に続けて置きます。開始・終了秒数へ合わせる必要はありません。
- 間を空ける必要がある箇所だけ、作業指示一覧の「空ける間」に記載されたフレーム数を空けます。空欄の場合は間を追加しません。
- オープニング動画が支給されている場合は、その直後から最初の音声を置きます。

### 2-4. BGM を敷く
- \`${M.assets.bgm || '素材/BGM/BGM.wav'}\` を **オーディオトラック A2** に置き、動画の最後まで伸ばす（足りなければコピーして繋ぐ）。
- BGM のクリップを選び、**声がはっきり聞こえる音量**まで下げます。固定の−20dBではなく、支給された見本動画の音量感を基準にします。

### 2-5. 図解・立ち絵を置く
- 各シーンのアニメーション済みMP4または図解を **ビデオトラック V1** に置き、そのシーンの音声と**長さをそろえる**。
- MP4に人物の動きが含まれている場合は、立ち絵PNGを別途置く必要はありません。MP4がない場合だけ立ち絵PNGを **V2** に置きます。
- 図解は画面下端から150pxを字幕用に空ける。1280×720素材はズーム79％を初期値にし、縦横比を保って重要な文字や図が隠れないように調整する。
- 静止画PNGしか支給されていない場合、利用者が画像を分解してアニメーションを作る必要はありません。動きが必要なシーンは、支給されたアニメーション済み動画を使用します。

### 2-6. 字幕・テロップを入れる
- 上のメニュー「Effects → Titles → **Text+**」をタイムラインの **V3以上**にドラッグ。
- **セリフ字幕**：画面下部に表示します。本文は共通の濃い文字色にし、話者名と字幕左側の帯を話者色にします（${Object.entries(SPEAKER_COLOR).map(([k, v]) => `${k}=${v}`).join(' / ')}）。
- **字幕の完成基準**：本文は Yu Gothic UI（なければメイリオ）、太字、30px相当、#2C3A30、最大2行。話者名は同フォント、太字、15px相当。背景 #FFFDF6、枠線 #E4D9BE、左側の話者色ラインは幅7px。横中央、左右30px以上、下端26px以上の余白を確保します。
- **話者色**：ナレーション #C9D2D0、ハル #4F8BE0、ミナ先生 #3EB489。本文の文字色は話者ごとに変えません。
- **強調テロップ**：作業指示一覧に文字があるシーンだけ入れます。Yu Gothic UI（なければメイリオ）、太字、46px相当、文字色 #08201D、背景色 #FCEEC0、高さ74px、横中央、上端150pxを基準にします。

### 2-7. 書き出し（Deliver）
1. 下の「Deliver（デリバー）」ページを開く。
2. Format = **MP4**、Codec = **H.264**、解像度 **${M.spec.width}x${M.spec.height}**、フレームレート **${M.spec.fps}**。
3. 「Add to Render Queue」→「Render All」。

---

## 3. シーン別 作業カード

カードを上から順番に進めます。まず②の音声を順番に置いてから、①の絵・③のテロップを乗せます。細かな開始・終了秒数へ合わせる必要はありません。

${M.scenes.map(card).join('\n---\n\n')}

---

## 4. 仕上げチェック

- [ ] すべてのセリフに字幕が付き、本文色と話者名・帯の色分けが見本と一致している
- [ ] 図解・立ち絵が音声とズレていない
- [ ] 強調テロップが各シーンに入っている
- [ ] BGM が声の邪魔をしていない（小さめ）
- [ ] 依頼書・作業指示一覧の順番どおりに仕上がっている
- [ ] 書き出した動画が ${M.spec.width}x${M.spec.height} / ${M.spec.fps}fps になっている

> 数字や制度（税率・非課税枠など）は支給素材（音声・作業指示一覧）のとおりに入れてください。内容を勝手に変えないこと。
`;

writeFileSync(`${DIR}/手順書.md`, doc, 'utf8');
console.log(`=== 手順書生成: ${DIR}/手順書.md （${M.scenes.length}シーンの作業カード） ===`);
if (!existsSync(`${DIR}/完成見本.mp4`)) console.log('  ⚠ 完成見本.mp4 が見つかりません');
