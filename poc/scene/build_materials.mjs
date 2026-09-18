// VideoProject(data.json) → 就労者が DaVinci でフル編集するための「素材フォルダ」を書き出す。
//   ・図解は overlay(テロップ/字幕/セクション)を外した no-telop の完成フレームPNG
//   ・立ち絵/BGM/背景はコピー、音声は vox キャッシュ(シーン別・話者別)をコピー
//   ・作業指示一覧.csv（利用者向け。順番中心で絶対タイムコードは出さない）と 素材一覧.json を出力
//   使い方: node poc/scene/build_materials.mjs [project.json] [出力フォルダ]
import sharp from 'sharp';
import { mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { adaptBuilder, genericCard } from './builders.mjs';
import { sceneSchedule, exprFor, SPEAKER_JA, probe } from './timing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = HERE + '/../..';
const PROJECT = process.argv[2] || 'poc/scene/out/data.json';
const OUTDIR = process.argv[3] || 'poc/scene/out/就労者パッケージ_新NISA';
const VOX = process.env.SCENE_VOX_DIR || 'poc/scene/out/vox';
const VISUAL_ASSET_DIR = process.env.SCENE_VISUAL_ASSET_DIR || 'poc/scene/out/work/visual_assets';
const CHARDIR = 'poc/character/out/cutout/reel';
// 完成見本（render_project.mjs）と同じ BGM・オープニング・エンディングを支給する
const BGM_SRC = process.env.BGM_FILE || 'assets/video/bgm_classroom_body.wav';
const OPENING_SRC = 'assets/video/opening.mp4';
const ENDING_SRC = 'assets/video/ending.mp4';
const TITLE_INTRO = 3.0; // render_project がタイトル導入を先頭に3秒入れる分のオフセット
const W = 1280, H = 720;

const VISUAL_JA = { comparison: '比較図', number_animation: '数字アニメ', chart: 'グラフ', infographic: '概念図', character_conversation: '会話', character_explanation: 'キャラ解説', text_emphasis: '強調テロップ', timeline: '年表', process: '手順図', recap: 'まとめ', generated_video: 'AI映像', broll: '実写素材' };
const SECTION_JA = { hook: '導入・フック', problem: '問題提起', basics: '基礎説明', example: '具体例', dialogue: '疑問と誤解', caution: '注意点', summary: 'まとめ', cta: 'はじめ方・行動喚起' };
const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;

async function svgToPng(svg, file) { await sharp(Buffer.from(svg)).png().toFile(file); }

// DaVinci はセリフ(A1)と BGM(A2) をそのまま足すので、素材の声がそのままだと完成見本より約3LU大きく、
// ピークも 0dBFS に張り付く。支給する音声側で下げておけば、就労者は音量を触らずに見本と同じ仕上がりになる。
const VOICE_GAIN_DB = -3;
function copyVoice(src, dst) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', `volume=${VOICE_GAIN_DB}dB`, '-c:a', 'pcm_s16le', dst], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(dst)) {
    console.warn(`  音量調整に失敗したのでそのままコピーします: ${basename(src)} ${r.stderr || ''}`);
    copyFileSync(src, dst);
  }
}

// 会話シーン用の暗い背景（立ち絵を乗せる下地）
function convBgSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1a1e"/><stop offset="1" stop-color="#13272b"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/></svg>`;
}

async function main() {
  const project = JSON.parse(readFileSync(PROJECT, 'utf8'));
  const scenes = project.scenes;
  rmSync(OUTDIR, { recursive: true, force: true });
  for (const d of ['素材/映像', '素材/図解', '素材/立ち絵', '素材/音声', '素材/BGM', '素材/背景']) mkdirSync(`${OUTDIR}/${d}`, { recursive: true });

  const manifest = { title: project.title, theme: project.theme ?? "", goal: project.goal ?? "", spec: { width: W, height: H, fps: 24, format: 'mp4 (H.264)' }, titleIntroSec: TITLE_INTRO, scenes: [], assets: {} };
  const csv = [['シーン', 'セクション', '演者', 'セリフ', '映像タイプ', '図解・映像素材名', '音声素材名', '立ち絵素材名', '強調テロップ', '空ける間(フレーム)', '補足'].map(csvCell).join(',')];

  let absStart = TITLE_INTRO;
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const tag = String(si + 1).padStart(3, '0');
    const no = si + 1;
    const typeJa = VISUAL_JA[scene.visual.type] || scene.visual.type;
    const { D, lines } = sceneSchedule(scene, VOX, tag);
    const isConv = scene.visual.type === 'character_conversation';
    process.stdout.write(`[S${no}] ${scene.section}/${scene.visual.type} `);

    // 1) 見本と同じ動きの映像素材。レンダ工程が未実行の場合のみ静止画へフォールバック。
    let figFile = '';
    const renderedVisual = `${VISUAL_ASSET_DIR}/visual_${tag}.mp4`;
    if (existsSync(renderedVisual)) {
      figFile = `素材/映像/S${String(no).padStart(2, '0')}_${typeJa}.mp4`;
      copyFileSync(renderedVisual, `${OUTDIR}/${figFile}`);
    } else if (isConv) {
      figFile = `素材/背景/会話背景.png`;
      if (!existsSync(`${OUTDIR}/${figFile}`)) await svgToPng(convBgSvg(), `${OUTDIR}/${figFile}`);
    } else {
      const builder = adaptBuilder(scene, D) || genericCard(scene);
      figFile = `素材/図解/S${String(no).padStart(2, '0')}_${typeJa}.png`;
      await svgToPng(builder(D), `${OUTDIR}/${figFile}`); // t=D → 全リビール完了の完成状態
    }

    // 2) 音声（シーン別・話者別）を VOICE_GAIN_DB ぶん下げて書き出す
    const audioFiles = [];
    lines.forEach((ln) => {
      if (!existsSync(ln.file)) { process.stdout.write('!'); return; }
      const spJa = SPEAKER_JA[ln.speaker] || ln.speaker;
      const dst = `素材/音声/S${String(no).padStart(2, '0')}_${String(ln.li + 1).padStart(2, '0')}_${spJa}.wav`;
      copyVoice(ln.file, `${OUTDIR}/${dst}`);
      audioFiles.push(dst);
    });

    // 3) この後の CSV/manifest 用に、行ごとの立ち絵・字幕・テロップを収集
    const telops = (scene.visual.onScreenText || []).filter(Boolean);
    // 完成見本で上に重ねる強調テロップは「会話」シーンの1語目だけ。図解系は映像素材に文字が焼き込み済み。
    const overlayTelop = isConv ? (telops[0] || '') : '';
    const telopNote = overlayTelop
      ? '強調テロップは、この場面の2つ目のセリフの頭から場面の終わりまで表示。'
      : (!isConv && telops.length ? '強調テロップは不要（映像の中に文字が入っています）。' : '');
    const rowLines = lines.map((ln, k) => ({
      li: ln.li, speaker: ln.speaker, speakerJa: SPEAKER_JA[ln.speaker] || ln.speaker,
      text: ln.text, emphasis: ln.emphasis,
      startAbs: absStart + ln.start, endAbs: absStart + ln.end,
      expr: isConv ? exprFor(ln.speaker, ln.emotion) : null,
      audio: audioFiles[k] || '',
    }));

    manifest.scenes.push({ no, tag, section: scene.section, type: scene.visual.type, typeJa,
      visualAssetKind: figFile.endsWith('.mp4') ? 'video' : 'image',
      startAbs: +absStart.toFixed(2), endAbs: +(absStart + D).toFixed(2), durationSec: +D.toFixed(2),
      figure: figFile, telops, overlayTelop, editNote: scene.visual.description || '', lines: rowLines });

    // CSV 行（発話ごと）。強調テロップ列は「重ねて入れる文字」だけを書く。
    const note = [telopNote, scene.visual.description || ''].filter(Boolean).join(' ');
    if (rowLines.length === 0) {
      csv.push([`S${no}`, SECTION_JA[scene.section] || scene.section, '', '', typeJa, figFile, '', '', overlayTelop, '', note].map(csvCell).join(','));
    } else rowLines.forEach((r, k) => {
      csv.push([`S${no}`, k === 0 ? SECTION_JA[scene.section] || scene.section : '', r.speakerJa, r.text, k === 0 ? typeJa : '',
        k === 0 ? figFile : '', r.audio, r.expr || '', k === 0 ? overlayTelop : '', '', k === 0 ? note : ''].map(csvCell).join(','));
    });

    absStart += D;
    process.stdout.write('\n');
  }
  manifest.totalSec = +absStart.toFixed(2);

  // 4) 立ち絵（全14表情）・BGM をコピー
  const chars = existsSync(CHARDIR) ? readdirSync(CHARDIR).filter((f) => f.endsWith('.png')) : [];
  chars.forEach((f) => copyFileSync(`${CHARDIR}/${f}`, `${OUTDIR}/素材/立ち絵/${f}`));
  manifest.assets.characters = chars;
  if (existsSync(BGM_SRC)) { copyFileSync(BGM_SRC, `${OUTDIR}/素材/BGM/BGM.wav`); manifest.assets.bgm = '素材/BGM/BGM.wav'; }
  if (existsSync(OPENING_SRC)) { copyFileSync(OPENING_SRC, `${OUTDIR}/素材/映像/オープニング.mp4`); manifest.assets.opening = '素材/映像/オープニング.mp4'; }
  if (existsSync(ENDING_SRC)) { copyFileSync(ENDING_SRC, `${OUTDIR}/素材/映像/エンディング.mp4`); manifest.assets.ending = '素材/映像/エンディング.mp4'; }

  // 5) 完成見本をコピー
  // 完成見本は、この案件用に書き出したものだけを使う（別の動画を取り違えないよう、よその候補は探さない）
  const sample = [process.env.SAMPLE_VIDEO]
    .filter(Boolean).find((p) => existsSync(p));
  if (sample) { copyFileSync(sample, `${OUTDIR}/完成見本.mp4`); manifest.assets.sample = '完成見本.mp4'; manifest.sampleDurationSec = +probe(sample).toFixed(1); }

  // 6) 作業指示一覧.csv / 素材一覧.json / はじめに.txt
  writeFileSync(`${OUTDIR}/作業指示一覧.csv`, '﻿' + csv.join('\r\n'), 'utf8');
  writeFileSync(`${OUTDIR}/素材一覧.json`, JSON.stringify(manifest, null, 2), 'utf8');
  writeFileSync(`${OUTDIR}/はじめに.txt`, [
    `【${project.title}】 動画編集パッケージ`,
    '',
    'このフォルダの素材を使って、DaVinci Resolve で動画を1本つくります。',
    '',
    '■ 進め方',
    '1) 「手順書.md」を上から順番にやる。わからない所は支援員さんに聞く。',
    '2) 「作業指示一覧.csv」（Excelで開けます）を上から確認し、音声と素材を順番に置く。',
    '',
    '■ フォルダの中身',
    '・手順書.md    … この通りにやれば完成します（DaVinci Resolve 用）',
    '・作業指示一覧.csv … シーン・演者・セリフ・使用素材・必要な間の一覧',
    '・素材/映像    … 見本と同じ動きが付いたシーン別のMP4素材（利用者がアニメーションを作る必要はありません）',
    '・素材/図解    … 映像素材を生成できなかった場合に使う静止画',
    '・素材/立ち絵  … ハル・ミナ先生の表情ちがいの画像',
    '・素材/音声    … シーンごと・話す人ごとの声',
    '・素材/BGM     … 下に敷く音楽',
    '・素材/背景    … 会話シーンの背景',
    '',
    '※ 数字や制度（税率・非課税枠など）は支給素材（音声・作業指示一覧）のとおりに。内容は勝手に変えないこと。',
  ].join('\r\n'), 'utf8');

  console.log(`\n=== 素材書き出し完了: ${OUTDIR} ===`);
  console.log(`  図解 ${manifest.scenes.filter((s) => !s.figure.includes('背景')).length}点 / 立ち絵 ${chars.length}点 / 音声 ${manifest.scenes.reduce((n, s) => n + s.lines.filter((l) => l.audio).length, 0)}点 / 全${manifest.scenes.length}シーン / 尺${manifest.totalSec}s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
