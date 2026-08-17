// 音声付き 見本リール:
//   OpenAI合成音声(poc/tts-ab/out/reel/*.wav)の実尺に合わせてシーン尺・会話ターンを決め、
//   無音リールを描画→各セリフを算出オフセットでmux。声はナレ第一候補=OpenAI gpt-4o-mini-tts。
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { buildNumberSVG } from './number.mjs';
import { buildComparisonSVG } from './comparison.mjs';
import { buildChartSVG } from './chart.mjs';
import { buildProcessSVG } from './process.mjs';
import { buildConversationSVG } from './conversation.mjs';
import { buildTitleSVG, buildKeywordsSVG } from './title.mjs';
import { scene002, scene041, scene046, scene070 } from './scenes.mjs';
import { renderSubtitle, renderSection, inject } from './overlay.mjs';

const FPS = 30, OUT = 'poc/infographic/out', FR = `${OUT}/frames_v`;
const VOX = process.env.VOX_DIR || 'poc/tts-ab/out/reel';
const OUT_NAME = process.env.OUT_NAME || 'mock_reel_voiced';
function ff(args) { const r = spawnSync('ffmpeg', args, { encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stderr?.slice(-1000)); throw new Error('ffmpeg'); } }
function dur(id) {
  const p = `${VOX}/${id}.wav`;
  if (!existsSync(p)) throw new Error(`音声が無い: ${p}（先に node poc/tts-ab/reel_voice.mjs）`);
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p], { encoding: 'utf8' });
  return parseFloat(r.stdout.trim());
}

// --- 音声実尺から尺を決定 ---
const bDur = dur('b_narr') + 0.7;
const cDur = Math.max(7.5, dur('c_mina') + 1.2);
const haruDur = dur('d_haru') + 0.6;
const minaDur = dur('d_mina') + 0.7;
const convDur = haruDur + minaDur;
const eDur = Math.max(6.0, dur('e_narr') + 1.2);
const fDur = Math.max(5.5, dur('f_mina') + 1.2);
const aDur = 3.0, gDur = 4.0;

const withSub = (build, scene, sub, section) => (t) =>
  inject(build(scene, t), renderSection(section) + renderSubtitle(sub.speaker, sub.text, 1));

const convScene = {
  section: '疑問と誤解',
  telop: { text: 'NISA ＝ 元本保証ではない', at: haruDur + 0.8 },
  turns: [
    { speaker: 'haru', start: 0, dur: haruDur, text: 'ミナ先生、NISAなら絶対に儲かるんですか！？' },
    { speaker: 'mina', start: haruDur, dur: minaDur, text: 'そこは、かなり勘違いしやすいポイントだよ。' },
  ],
};
const titleScene = { title: '新NISAって結局何？', subtitle: '10分でわかる・お金の基本' };
const ctaScene = { headline: '覚えるのは、この3つ', words: ['長期', '積立', '分散'], note: '最初の一歩は「口座を開く」だけ' };

// リール構成: [builder(t), dur, tag]
const REEL = [
  [(t) => buildTitleSVG(titleScene, t), aDur, 'a'],
  [withSub(buildNumberSVG, scene002, { speaker: 'narrator', text: '毎月1万円。20年後、その差は約171万円。' }, 'フック'), bDur, 'b'],
  [withSub(buildComparisonSVG, scene041, { speaker: 'mina', text: 'NISAなら、利益にかかる税金がゼロ円になるの。' }, '数字で見る'), cDur, 'c'],
  [(t) => buildConversationSVG(convScene, t), convDur, 'd'],
  [withSub(buildChartSVG, scene046, { speaker: 'narrator', text: '長い目で見ると、この差が効いてきます。' }, '資産推移'), eDur, 'e'],
  [withSub(buildProcessSVG, scene070, { speaker: 'mina', text: 'はじめ方は、たったの3ステップだよ。' }, 'はじめ方'), fDur, 'f'],
  [(t) => buildKeywordsSVG(ctaScene, t), gDur, 'g'],
];

// --- 各セリフの再生開始オフセット（累積尺 + リードイン） ---
let cum = 0; const starts = {};
for (const [, d, tag] of REEL) { starts[tag] = cum; cum += d; }
const voiceCues = [
  { id: 'b_narr', at: starts.b + 0.35 },
  { id: 'c_mina', at: starts.c + 0.7 },
  { id: 'd_haru', at: starts.d + 0.3 },
  { id: 'd_mina', at: starts.d + haruDur + 0.3 },
  { id: 'e_narr', at: starts.e + 0.5 },
  { id: 'f_mina', at: starts.f + 0.45 },
];

// --- 無音リール描画 ---
rmSync(FR, { recursive: true, force: true });
mkdirSync(FR, { recursive: true });
const clips = [];
for (const [build, d, tag] of REEL) {
  const n = Math.round(d * FPS);
  process.stdout.write(`\n[${tag}] ${n}f `);
  for (let i = 0; i < n; i++) {
    await sharp(Buffer.from(build(i / FPS))).png().toFile(`${FR}/${tag}_${String(i).padStart(4, '0')}.png`);
    if (i % 30 === 0) process.stdout.write('.');
  }
  const mp4 = `${OUT}/v_${tag}.mp4`;
  ff(['-y', '-framerate', String(FPS), '-i', `${FR}/${tag}_%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
  clips.push(`v_${tag}.mp4`);
}
writeFileSync(`${OUT}/v_list.txt`, clips.map((c) => `file '${c}'`).join('\n') + '\n');
const silent = `${OUT}/_voiced_silent.mp4`;
ff(['-y', '-f', 'concat', '-safe', '0', '-i', `${OUT}/v_list.txt`, '-c', 'copy', silent]);

// --- 音声mux（各セリフを adelay で配置 → amix） ---
const inputs = ['-i', silent];
voiceCues.forEach((c) => inputs.push('-i', `${VOX}/${c.id}.wav`));
const fc = voiceCues.map((c, k) => `[${k + 1}:a]adelay=${Math.round(c.at * 1000)}:all=1[a${k}]`).join(';')
  + ';' + voiceCues.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${voiceCues.length}:normalize=0[aout]`;
const outMp4 = `${OUT}/${OUT_NAME}.mp4`;
ff(['-y', ...inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[aout]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', outMp4]);

// 後片付け
rmSync(FR, { recursive: true, force: true });
clips.forEach((c) => rmSync(`${OUT}/${c}`, { force: true }));
rmSync(`${OUT}/v_list.txt`, { force: true });
rmSync(silent, { force: true });

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type', '-of', 'default=noprint_wrappers=1', outMp4], { encoding: 'utf8' });
console.log('\n\n--- mock_reel_voiced.mp4 ---\n' + probe.stdout, 'done:', existsSync(outMp4));
console.log('cues:', voiceCues.map((c) => `${c.id}@${c.at.toFixed(1)}s`).join('  '));
