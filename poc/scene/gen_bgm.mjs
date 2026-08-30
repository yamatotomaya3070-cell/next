// 教室×黒板テーマ「マネーの学校」BGM生成（ffmpeg 波形合成のみ・外部音源不使用）。
//   ピアノ/木琴風＝減衰する正弦波＋倍音のアルペジオ。進行 Cmaj7→Am7→Fmaj7→G。
//   本編(body)/オープニング(opening)/エンディング(ending) の3種を同一音色ファミリーで生成する。
//   出力: assets/video/bgm_classroom_body.wav / bgm_opening.wav / bgm_ending.wav
//   使い方: node poc/scene/gen_bgm.mjs
//   ※ 旧 assets/video/bgm_loop.wav は据え置き（本スクリプトは触らない）。
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const OUT_DIR = 'assets/video';
const SR = 44100;

// 4和音（各4声）。Hz。C4=261.63 基準。
const CHORDS = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7  C E G B
  [220.00, 261.63, 329.63, 392.00], // Am7    A C E G
  [174.61, 220.00, 261.63, 329.63], // Fmaj7  F A C E
  [196.00, 246.94, 293.66, 349.23], // G7     G B D F
];
// 1小節=8分音符8つ。和音内の声部インデックス列（上下する穏やかなアルペジオ）。
const PATTERN = [0, 1, 2, 3, 2, 1, 0, 2];
// 8分ごとのベロシティ（拍頭を少し強く）。
const VEL = [1.0, 0.72, 0.86, 0.72, 0.9, 0.72, 0.82, 0.7];

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr?.slice(-1200)); throw new Error('ffmpeg failed'); }
}

// 減衰正弦＋倍音（木琴/ピアノ寄り）。t=ノート内時刻。振幅は velocity で調整。
function noteExpr(freq, decay) {
  const f = freq.toFixed(3);
  return `exp(-${decay}*t)*sin(2*PI*${f}*t)`
    + `+0.35*exp(-${(decay * 1.6).toFixed(2)}*t)*sin(2*PI*${(freq * 2).toFixed(3)}*t)`
    + `+0.12*exp(-${(decay * 2.2).toFixed(2)}*t)*sin(2*PI*${(freq * 3).toFixed(3)}*t)`;
}

function makeVariant({ tag, bpm, velScale, decay, ring, lowpass, echo, gain }) {
  const out = `${OUT_DIR}/${tag}.wav`;
  const eighth = 60 / bpm / 2;          // 8分音符長(秒)
  const bar = eighth * 8;
  const total = bar * CHORDS.length;    // 4小節=1ループ

  const notes = [];
  CHORDS.forEach((chord, b) => {
    PATTERN.forEach((voice, e) => {
      notes.push({ freq: chord[voice], at: b * bar + e * eighth, vel: VEL[e] * velScale });
    });
  });

  const inputs = [];
  const filters = [];
  notes.forEach((n, k) => {
    inputs.push('-f', 'lavfi', '-i', `aevalsrc=${noteExpr(n.freq, decay)}:d=${ring.toFixed(2)}:s=${SR}`);
    const ms = Math.round(n.at * 1000);
    filters.push(`[${k}:a]adelay=${ms}:all=1,volume=${n.vel.toFixed(3)}[n${k}]`);
  });
  const mixIn = notes.map((_, k) => `[n${k}]`).join('');
  const post = `amix=inputs=${notes.length}:normalize=0,`
    + `lowpass=f=${lowpass},`
    + `aecho=0.8:0.6:${echo.delay}:${echo.decay},`
    + `volume=${gain},`
    + `alimiter=limit=0.92,`
    + `atrim=0:${total.toFixed(2)},`
    + `afade=t=in:d=0.04`;
  const fc = filters.join(';') + ';' + mixIn + post + '[out]';

  ff(['-y', ...inputs, '-filter_complex', fc, '-map', '[out]', '-ar', String(SR), '-ac', '2', out]);
  console.log(`生成: ${out} (${total.toFixed(1)}s / ${bpm}bpm / ${notes.length}notes)`);
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  // 本編: 静かでゆったり。声を邪魔しない。
  makeVariant({ tag: 'bgm_classroom_body', bpm: 72, velScale: 0.9, decay: 6.0, ring: 1.3, lowpass: 3000, echo: { delay: 45, decay: 0.22 }, gain: 1.7 });
  // オープニング: 少し明るく・速く（開始のアレンジ）。
  makeVariant({ tag: 'bgm_opening', bpm: 88, velScale: 1.05, decay: 5.2, ring: 1.2, lowpass: 4200, echo: { delay: 40, decay: 0.28 }, gain: 1.9 });
  // エンディング: テンポを落とし落ち着いた締め。
  makeVariant({ tag: 'bgm_ending', bpm: 60, velScale: 0.82, decay: 6.6, ring: 1.7, lowpass: 2600, echo: { delay: 55, decay: 0.2 }, gain: 1.6 });
  console.log('BGM生成完了（bgm_loop.wav は据え置き）');
}

main();
