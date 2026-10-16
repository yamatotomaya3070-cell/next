import { FINGERPRINT_SAMPLE_RATE } from "./fingerprint";

/**
 * セリフ音声の前後の無音を切る（指紋で探す前に使う）。
 *
 * 支給するセリフ音声には、タイムラインに詰めて並べるための無音が前後に入っている
 * （poc/scene/timing.mjs の voicePadding）。無音のまま指紋を作ると、声の部分の割合が下がって
 * 見つけにくくなり、見つかった位置も「声が出る位置」ではなく「無音の頭」になる。
 */

/** これより小さい音は無音とみなす（-40dBFS） */
export const SILENCE_AMPLITUDE = 0.01;
/** 無音かどうかを見る区切り（秒） */
const WINDOW_SEC = 0.01;

export interface TrimmedVoice {
  samples: Float32Array;
  /** 切り落とした頭の無音（秒） */
  leadSec: number;
}

export function trimSilence(samples: Float32Array, sampleRate = FINGERPRINT_SAMPLE_RATE): TrimmedVoice {
  const win = Math.max(1, Math.round(sampleRate * WINDOW_SEC));
  const loud = (from: number) => {
    const to = Math.min(samples.length, from + win);
    for (let i = from; i < to; i++) if (Math.abs(samples[i]) >= SILENCE_AMPLITUDE) return true;
    return false;
  };
  let head = 0;
  while (head < samples.length && !loud(head)) head += win;
  if (head >= samples.length) return { samples, leadSec: 0 }; // 全部無音なら切らない
  let tail = samples.length;
  while (tail > head && !loud(Math.max(head, tail - win))) tail -= win;
  return { samples: samples.subarray(head, tail), leadSec: head / sampleRate };
}
