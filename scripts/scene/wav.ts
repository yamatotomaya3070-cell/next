// 16bit モノラル WAV の読み書きと、簡単な加工（カット練習用の収録データを組み立てるため）。
// ffmpeg を何十回も呼ぶと Windows では遅いので、つなぐ・音量を変える・2倍に伸ばすはここで行う。
import { readFileSync, writeFileSync } from "node:fs";

export interface Pcm {
  rate: number;
  samples: Float32Array; // -1〜1
}

export function readWav(file: string): Pcm {
  const buf = readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error(`WAV ではありません: ${file}`);
  let pos = 12;
  let rate = 0;
  let channels = 1;
  let bits = 16;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      if (bits !== 16) throw new Error(`16bit の WAV だけ読めます: ${file}`);
      const end = Math.min(body + size, buf.length);
      const frames = Math.floor((end - body) / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += buf.readInt16LE(body + (i * channels + c) * 2);
        samples[i] = sum / channels / 32768;
      }
      return { rate, samples };
    }
    pos = body + size + (size % 2);
  }
  throw new Error(`WAV のデータが見つかりません: ${file}`);
}

export function writeWav(file: string, { rate, samples }: Pcm): void {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

/** 24kHz → 48kHz のように、ちょうど整数倍に伸ばす（間は直線でつなぐ） */
export function upsample(pcm: Pcm, rate: number): Pcm {
  if (pcm.rate === rate) return pcm;
  const k = rate / pcm.rate;
  if (!Number.isInteger(k)) throw new Error(`${pcm.rate}Hz から ${rate}Hz には伸ばせません`);
  const src = pcm.samples;
  const out = new Float32Array(src.length * k);
  for (let i = 0; i < src.length; i++) {
    const a = src[i];
    const b = i + 1 < src.length ? src[i + 1] : a;
    for (let j = 0; j < k; j++) out[i * k + j] = a + ((b - a) * j) / k;
  }
  return { rate, samples: out };
}

export const dbToGain = (db: number) => 10 ** (db / 20);

/** 声が出ている所（小さい音をのぞく）の大きさの平均（RMS） */
export function speechRms(samples: Float32Array): number {
  let sum = 0;
  let n = 0;
  for (const v of samples) {
    if (Math.abs(v) < 0.01) continue;
    sum += v * v;
    n++;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

/** 前後の無音を落とす（音声合成の声は前後に無音が付いてくることがある） */
export function trimSilence(samples: Float32Array, rate: number, threshold = 0.01): Float32Array {
  const keep = Math.round(rate * 0.03);
  let a = 0;
  while (a < samples.length && Math.abs(samples[a]) < threshold) a++;
  let b = samples.length - 1;
  while (b > a && Math.abs(samples[b]) < threshold) b--;
  return samples.slice(Math.max(0, a - keep), Math.min(samples.length, b + 1 + keep));
}

/**
 * from より後ろで、最初に minSec 以上つづく小さい音（文の切れ目）が始まる位置を返す。無ければ全体の長さ。
 * セリフに文がいくつもあるとき、1つ目の文の長さを知るのに使う。
 */
export function firstPauseAfter(samples: Float32Array, rate: number, from: number, minSec = 0.15, threshold = 0.02): number {
  const win = Math.round(rate * 0.02);
  const need = Math.ceil((minSec * rate) / win);
  let run = 0;
  for (let s = Math.max(0, from); s + win <= samples.length; s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += samples[i] * samples[i];
    run = Math.sqrt(e / win) < threshold ? run + 1 : 0;
    if (run >= need) return s + win - run * win;
  }
  return samples.length;
}

/**
 * aim から後ろへ、声が出ている所（20ミリ秒の大きさが threshold 以上）を探して、その位置を返す。
 * 言いまちがえは「言葉の途中で止まる」ので、文の切れ目（無音）では切らないようにする。見つからなければ aim。
 */
export function speakingPointAfter(samples: Float32Array, rate: number, aim: number, limit: number, threshold = 0.03): number {
  const win = Math.round(rate * 0.02);
  for (let s = Math.max(0, aim); s + win <= Math.min(samples.length, limit); s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += samples[i] * samples[i];
    if (Math.sqrt(e / win) >= threshold) return s + win;
  }
  return aim;
}

/** 終わりを短くフェードアウトさせる（途中で切った声が「プツッ」と鳴らないように） */
export function fadeOut(samples: Float32Array, rate: number, sec = 0.015): Float32Array {
  const out = samples.slice();
  const n = Math.min(out.length, Math.round(rate * sec));
  for (let i = 0; i < n; i++) out[out.length - 1 - i] *= i / n;
  return out;
}

/** 半分の速さで取り直す（48kHz → 24kHz）。となり2つの平均をとって、高すぎる音で折り返しが出ないようにする */
export function downsampleHalf(pcm: Pcm): Pcm {
  const src = pcm.samples;
  const out = new Float32Array(Math.floor(src.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = (src[2 * i] + src[2 * i + 1]) / 2;
  return { rate: pcm.rate / 2, samples: out };
}
