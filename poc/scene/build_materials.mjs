// VideoProject(data.json) → 就労者が DaVinci でフル編集するための「素材フォルダ」を書き出す。
//   ・図解は overlay(テロップ/字幕/セクション)を外した no-telop の完成フレームPNG
//   ・立ち絵/BGM/背景はコピー、音声は vox キャッシュ(シーン別・話者別)をコピー
//   ・タイミング表.csv（完成見本と一致する絶対タイムコード）と 素材一覧.json を出力
//   使い方: node poc/scene/build_materials.mjs [project.json] [出力フォルダ]
import sharp from 'sharp';
import { mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptBuilder, genericCard } from './builders.mjs';
import { sceneSchedule, exprFor, SPEAKER_JA, fmt, probe } from './timing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = HERE + '/../..';
const PROJECT = process.argv[2] || 'poc/scene/out/data.json';
const OUTDIR = process.argv[3] || 'poc/scene/out/就労者パッケージ_新NISA';
const VOX = 'poc/scene/out/vox';
const CHARDIR = 'poc/character/out/cutout/reel';
const BGM_SRC = 'assets/video/bgm_loop.wav';
const TITLE_INTRO = 3.0; // render_project がタイトル導入を先頭に3秒入れる分のオフセット
const W = 1280, H = 720;

const VISUAL_JA = { comparison: '比較図', number_animation: '数字アニメ', chart: 'グラフ', infographic: '概念図', character_conversation: '会話', character_explanation: 'キャラ解説', text_emphasis: '強調テロップ', timeline: '年表', process: '手順図', recap: 'まとめ', generated_video: 'AI映像', broll: '実写素材' };
const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;

async function svgToPng(svg, file) { await sharp(Buffer.from(svg)).png().toFile(file); }

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
  for (const d of ['素材/図解', '素材/立ち絵', '素材/音声', '素材/BGM', '素材/背景']) mkdirSync(`${OUTDIR}/${d}`, { recursive: true });

  const manifest = { title: project.title, spec: { width: W, height: H, fps: 24, format: 'mp4 (H.264)' }, titleIntroSec: TITLE_INTRO, scenes: [], assets: {} };
  const csv = [['シーン', 'セクション', '映像タイプ', '開始(絶対)', '終了(絶対)', '話者', 'セリフ字幕', '強調テロップ', '図解ファイル', '音声ファイル', '立ち絵'].map(csvCell).join(',')];

  let absStart = TITLE_INTRO;
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const tag = String(si + 1).padStart(3, '0');
    const no = si + 1;
    const typeJa = VISUAL_JA[scene.visual.type] || scene.visual.type;
    const { D, lines } = sceneSchedule(scene, VOX, tag);
    const isConv = scene.visual.type === 'character_conversation';
    process.stdout.write(`[S${no}] ${scene.section}/${scene.visual.type} `);

    // 1) 図解（no-telop 完成フレーム）。会話は背景のみ。
    let figFile = '';
    if (isConv) {
      figFile = `素材/背景/会話背景.png`;
      if (!existsSync(`${OUTDIR}/${figFile}`)) await svgToPng(convBgSvg(), `${OUTDIR}/${figFile}`);
    } else {
      const builder = adaptBuilder(scene, D) || genericCard(scene);
      figFile = `素材/図解/S${String(no).padStart(2, '0')}_${typeJa}.png`;
      await svgToPng(builder(D), `${OUTDIR}/${figFile}`); // t=D → 全リビール完了の完成状態
    }

    // 2) 音声（シーン別・話者別）をコピー
    const audioFiles = [];
    lines.forEach((ln) => {
      if (!existsSync(ln.file)) { process.stdout.write('!'); return; }
      const spJa = SPEAKER_JA[ln.speaker] || ln.speaker;
      const dst = `素材/音声/S${String(no).padStart(2, '0')}_${String(ln.li + 1).padStart(2, '0')}_${spJa}.wav`;
      copyFileSync(ln.file, `${OUTDIR}/${dst}`);
      audioFiles.push(dst);
    });

    // 3) この後の CSV/manifest 用に、行ごとの立ち絵・字幕・テロップを収集
    const telops = (scene.visual.onScreenText || []).filter(Boolean);
    const rowLines = lines.map((ln, k) => ({
      li: ln.li, speaker: ln.speaker, speakerJa: SPEAKER_JA[ln.speaker] || ln.speaker,
      text: ln.text, emphasis: ln.emphasis,
      startAbs: absStart + ln.start, endAbs: absStart + ln.end,
      expr: isConv ? exprFor(ln.speaker, ln.emotion) : null,
      audio: audioFiles[k] || '',
    }));

    manifest.scenes.push({ no, tag, section: scene.section, type: scene.visual.type, typeJa,
      startAbs: +absStart.toFixed(2), endAbs: +(absStart + D).toFixed(2), durationSec: +D.toFixed(2),
      figure: figFile, telops, editNote: scene.visual.description || '', lines: rowLines });

    // CSV 行（発話ごと）
    if (rowLines.length === 0) {
      csv.push([`S${no}`, scene.section, typeJa, fmt(absStart), fmt(absStart + D), '', '', telops.join(' / '), figFile, '', ''].map(csvCell).join(','));
    } else rowLines.forEach((r, k) => {
      csv.push([`S${no}`, k === 0 ? scene.section : '', k === 0 ? typeJa : '', fmt(r.startAbs), fmt(r.endAbs), r.speakerJa, r.text,
        k === 0 ? telops.join(' / ') : '', k === 0 ? figFile : '', r.audio, r.expr || ''].map(csvCell).join(','));
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

  // 5) 完成見本をコピー（SAMPLE_VIDEO env 優先→納品フォルダ→最新 newnisa_video*）
  const sample = [process.env.SAMPLE_VIDEO, 'poc/scene/out/納品_新NISA/完成見本.mp4', 'poc/scene/out/newnisa_video7.mp4', 'poc/scene/out/newnisa_video6.mp4']
    .filter(Boolean).find((p) => existsSync(p));
  if (sample) { copyFileSync(sample, `${OUTDIR}/完成見本.mp4`); manifest.assets.sample = '完成見本.mp4'; manifest.sampleDurationSec = +probe(sample).toFixed(1); }

  // 6) タイミング表.csv / 素材一覧.json / はじめに.txt
  writeFileSync(`${OUTDIR}/タイミング表.csv`, '﻿' + csv.join('\r\n'), 'utf8');
  writeFileSync(`${OUTDIR}/素材一覧.json`, JSON.stringify(manifest, null, 2), 'utf8');
  writeFileSync(`${OUTDIR}/はじめに.txt`, [
    `【${project.title}】 動画編集パッケージ`,
    '',
    'このフォルダの素材を使って、DaVinci Resolve で動画を1本つくります。',
    '',
    '■ 進め方',
    '1) 「手順書.md」を上から順番にやる。わからない所は支援員さんに聞く。',
    '2) 「タイミング表.csv」（Excelで開けます）で音声を置く時間を確認する。',
    '',
    '■ フォルダの中身',
    '・手順書.md    … この通りにやれば完成します（DaVinci Resolve 用）',
    '・タイミング表.csv … 各セリフ・図解を出す時間の一覧',
    '・素材/図解    … 画面いっぱいに置く図（テロップは自分で入れます）',
    '・素材/立ち絵  … ハル・ミナ先生の表情ちがいの画像',
    '・素材/音声    … シーンごと・話す人ごとの声',
    '・素材/BGM     … 下に敷く音楽',
    '・素材/背景    … 会話シーンの背景',
    '',
    '※ 数字や制度（税率・非課税枠など）は支給素材（音声・タイミング表）のとおりに。内容は勝手に変えないこと。',
  ].join('\r\n'), 'utf8');

  console.log(`\n=== 素材書き出し完了: ${OUTDIR} ===`);
  console.log(`  図解 ${manifest.scenes.filter((s) => !s.figure.includes('背景')).length}点 / 立ち絵 ${chars.length}点 / 音声 ${manifest.scenes.reduce((n, s) => n + s.lines.filter((l) => l.audio).length, 0)}点 / 全${manifest.scenes.length}シーン / 尺${manifest.totalSec}s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
