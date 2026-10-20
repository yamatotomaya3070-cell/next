/**
 * 練習で書き出した動画の音を、短い区切り（フレーム）ごとに調べる。
 * ブラウザ（利用者が書き出した動画）と scripts/practice（配った素材から答えの数字を作る）の両方で同じ計算を使う。
 * サンプリングレートに左右されないよう、時間はすべて秒で扱う。
 */

/** 1フレームの長さ（秒） */
export const FRAME_SEC = 0.01;
/** ピーの音の高さ（buildPracticeKits.ts の beep と同じ） */
export const BEEP_HZ = 1000;
/** これより小さい音は無音とみなす（dBFS） */
const SILENCE_FLOOR_DB = -60;
/** 声とみなす大きさ：大きい所から 28dB 下まで。ただし -48dB より小さい音は声にしない */
const SPEECH_BELOW_LOUD_DB = 28;
const SPEECH_MIN_DB = -48;
/** これより短い無音は、声の途中の切れ目として声に含める */
const MERGE_GAP_SEC = 0.12;
/** これより短い音のかたまりは声にしない（クリック音など） */
const MIN_SPEECH_SEC = 0.05;

export interface AudioFrames {
  /** 各フレームの大きさ（dBFS、RMS） */
  db: Float32Array;
  /** 各フレームのピーク（dBFS） */
  peakDb: Float32Array;
  /** 各フレームで、ピーの音（1kHz）がしめる割合（0〜1） */
  beepRatio: Float32Array;
  durationSec: number;
}

export interface Span {
  start: number;
  end: number;
}

const toDb = (v: number) => (v > 0 ? Math.max(SILENCE_FLOOR_DB - 40, 20 * Math.log10(v)) : SILENCE_FLOOR_DB - 40);

/** 音（モノラル）をフレームに分けて、大きさとピーの割合を出す */
export function analyzeSamples(samples: Float32Array, rate: number): AudioFrames {
  const size = Math.max(1, Math.round(rate * FRAME_SEC));
  const count = Math.floor(samples.length / size);
  const db = new Float32Array(count);
  const peakDb = new Float32Array(count);
  const beepRatio = new Float32Array(count);
  // Goertzel 法で 1kHz の強さを出す
  const coeff = 2 * Math.cos((2 * Math.PI * BEEP_HZ) / rate);
  for (let f = 0; f < count; f++) {
    let sum = 0;
    let peak = 0;
    let s1 = 0;
    let s2 = 0;
    for (let i = f * size; i < (f + 1) * size; i++) {
      const v = samples[i];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      const s0 = v + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    const energy = sum;
    db[f] = toDb(Math.sqrt(sum / size));
    peakDb[f] = toDb(peak);
    // 純音なら tone の強さは energy * size / 2 になる
    const tone = s1 * s1 + s2 * s2 - coeff * s1 * s2;
    beepRatio[f] = energy > 1e-9 ? Math.min(1, (2 * tone) / (energy * size)) : 0;
  }
  return { db, peakDb, beepRatio, durationSec: samples.length / rate };
}

/** 複数のチャンネルを1つにまとめる */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return SILENCE_FLOOR_DB - 40;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))];
}

/** フレームの範囲（秒）の大きさの分位 */
export function levelPercentile(frames: AudioFrames, span: Span, p: number): number {
  const from = Math.max(0, Math.floor(span.start / FRAME_SEC));
  const to = Math.min(frames.db.length, Math.ceil(span.end / FRAME_SEC));
  return percentile(Array.from(frames.db.subarray(from, to)), p);
}

export const isBeepFrame = (frames: AudioFrames, i: number) => frames.beepRatio[i] > 0.6 && frames.db[i] > SPEECH_MIN_DB;

/** 一続きの条件のフレームを、秒の区間にする（短い切れ目はつなげ、短すぎるかたまりは捨てる） */
function runs(flags: boolean[], mergeGapSec: number, minSec: number): Span[] {
  const spans: Span[] = [];
  let start = -1;
  flags.forEach((on, i) => {
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      spans.push({ start: start * FRAME_SEC, end: i * FRAME_SEC });
      start = -1;
    }
  });
  if (start >= 0) spans.push({ start: start * FRAME_SEC, end: flags.length * FRAME_SEC });
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end < mergeGapSec) merged[merged.length - 1] = { start: last.start, end: s.end };
    else merged.push(s);
  }
  return merged.filter((s) => s.end - s.start >= minSec);
}

/** ピーの音の区間 */
export function beepSpans(frames: AudioFrames): Span[] {
  const flags = Array.from(frames.db, (_, i) => isBeepFrame(frames, i));
  return runs(flags, 0.05, 0.15);
}

/**
 * 声（と、声くらい大きい音）の区間。ピーの音は声に含めない。
 * 区間 within を渡すと、その中だけで見る（BGM が入る前の所など）。
 */
export function speechSpans(frames: AudioFrames, within?: Span): Span[] {
  const all = Array.from(frames.db);
  const loud = percentile(all.filter((v) => v > SILENCE_FLOOR_DB), 0.95);
  const threshold = Math.max(SPEECH_MIN_DB, loud - SPEECH_BELOW_LOUD_DB);
  const flags = all.map((v, i) => {
    const t = i * FRAME_SEC;
    if (within && (t < within.start || t >= within.end)) return false;
    return v > threshold && !isBeepFrame(frames, i);
  });
  return runs(flags, MERGE_GAP_SEC, MIN_SPEECH_SEC);
}

export const totalSec = (spans: Span[]) => spans.reduce((n, s) => n + (s.end - s.start), 0);

/** 声と声のあいだ（だまっている所） */
export function gapsBetween(spans: Span[]): Span[] {
  return spans.slice(1).map((s, i) => ({ start: spans[i].end, end: s.start }));
}

/** 区間の中の声の大きさ（声のフレームの中央値、dBFS） */
export function speechLevel(frames: AudioFrames, spans: Span[]): number {
  const values: number[] = [];
  for (const s of spans) {
    for (let i = Math.floor(s.start / FRAME_SEC); i < Math.min(frames.db.length, Math.ceil(s.end / FRAME_SEC)); i++) values.push(frames.db[i]);
  }
  return percentile(values, 0.5);
}

/** 区間の中のいちばん大きいピーク（dBFS） */
export function maxPeak(frames: AudioFrames, span?: Span): number {
  const from = span ? Math.max(0, Math.floor(span.start / FRAME_SEC)) : 0;
  const to = span ? Math.min(frames.peakDb.length, Math.ceil(span.end / FRAME_SEC)) : frames.peakDb.length;
  let m = SILENCE_FLOOR_DB - 40;
  for (let i = from; i < to; i++) if (frames.peakDb[i] > m) m = frames.peakDb[i];
  return m;
}
