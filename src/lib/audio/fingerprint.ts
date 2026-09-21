/**
 * 音声の指紋（fingerprint）照合。
 *
 * 「提出動画の音声の中に、支給したセリフ音声（wav）がどこに入っているか」を、
 * 波形そのものではなくスペクトログラムのピーク（星座）で探す。
 * 再エンコード・音量の違い・BGMの重なりに強く、外部ライブラリを使わない純TS実装。
 *
 * 流れ:
 *   1. 8kHz モノラルの PCM を短時間フーリエ変換してスペクトログラムにする
 *   2. 各フレームで帯域ごとに目立つピークを拾う
 *   3. 近いピーク同士を組にしてハッシュ (f1, f2, Δt) を作る
 *   4. 探される側（提出動画）のハッシュを索引にし、探す側（セリフ）のハッシュを引く。
 *      「提出側の時刻 − セリフ側の時刻」が同じ値に集中していれば、そこにセリフがある
 */

export const FINGERPRINT_SAMPLE_RATE = 8000;
const WINDOW = 1024;
const HOP = 256;
const BINS = WINDOW / 2;
/** ピーク探索に使う周波数ビン範囲（約 78Hz〜3.9kHz。声の帯域） */
const MIN_BIN = 10;
const MAX_BIN = 500;
/** 帯域数（対数分割）。1フレームから最大この数だけピークを拾う */
const BAND_COUNT = 6;
/** フレーム平均より何倍（log10 領域の差）大きければピークとみなすか */
const PEAK_MARGIN_LOG = 0.6;
/** 1つのアンカーに組ませる後続ピーク数 */
const FANOUT = 6;
/** 組にする最大フレーム差（40フレーム ≒ 1.3秒） */
const MAX_PAIR_DT = 40;
/** 一致とみなす投票の時刻ずれ（±フレーム） */
const OFFSET_SLACK = 1;

export const FRAME_SEC = HOP / FINGERPRINT_SAMPLE_RATE;

export interface Hash {
  /** 24bit: f1(9) | f2(9) | dt(6) */
  code: number;
  /** ハッシュのアンカー時刻（フレーム番号） */
  frame: number;
}

export interface Fingerprint {
  hashes: Hash[];
  frameCount: number;
  durationSec: number;
}

// ---------------------------------------------------------------------------
// FFT（基数2・インプレース）
// ---------------------------------------------------------------------------

const BIT_REVERSE = buildBitReverse(WINDOW);
const HANN = buildHann(WINDOW);
const COS = new Float64Array(WINDOW / 2);
const SIN = new Float64Array(WINDOW / 2);
for (let i = 0; i < WINDOW / 2; i++) {
  COS[i] = Math.cos((-2 * Math.PI * i) / WINDOW);
  SIN[i] = Math.sin((-2 * Math.PI * i) / WINDOW);
}

function buildBitReverse(n: number): Uint32Array {
  const bits = Math.log2(n);
  const table = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    table[i] = r;
  }
  return table;
}

function buildHann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 0; i < n; i++) {
    const j = BIT_REVERSE[i];
    if (j > i) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = COS[k * step];
        const wi = SIN[k * step];
        const a = start + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// スペクトログラム → ピーク
// ---------------------------------------------------------------------------

/** 帯域の境界ビン（対数分割） */
const BAND_EDGES: number[] = (() => {
  const edges: number[] = [];
  const ratio = Math.log(MAX_BIN / MIN_BIN) / BAND_COUNT;
  for (let i = 0; i <= BAND_COUNT; i++) edges.push(Math.round(MIN_BIN * Math.exp(ratio * i)));
  return edges;
})();

interface Peak {
  frame: number;
  bin: number;
}

/** 1フレーム分の log 振幅スペクトルからピークを拾う */
function pickPeaks(logMag: Float64Array, frame: number, out: Peak[]): void {
  let sum = 0;
  for (let b = MIN_BIN; b < MAX_BIN; b++) sum += logMag[b];
  const mean = sum / (MAX_BIN - MIN_BIN);
  const threshold = mean + PEAK_MARGIN_LOG;

  for (let band = 0; band < BAND_COUNT; band++) {
    const lo = BAND_EDGES[band];
    const hi = BAND_EDGES[band + 1];
    let bestBin = -1;
    let best = -Infinity;
    for (let b = lo; b < hi; b++) {
      if (logMag[b] > best) {
        best = logMag[b];
        bestBin = b;
      }
    }
    if (bestBin >= 0 && best >= threshold) out.push({ frame, bin: bestBin });
  }
}

function spectrogramPeaks(samples: Float32Array): { peaks: Peak[]; frameCount: number } {
  const frameCount = samples.length < WINDOW ? 0 : Math.floor((samples.length - WINDOW) / HOP) + 1;
  const peaks: Peak[] = [];
  const re = new Float64Array(WINDOW);
  const im = new Float64Array(WINDOW);
  const logMag = new Float64Array(BINS);

  for (let f = 0; f < frameCount; f++) {
    const offset = f * HOP;
    for (let i = 0; i < WINDOW; i++) {
      re[i] = samples[offset + i] * HANN[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    for (let b = 0; b < BINS; b++) {
      logMag[b] = Math.log10(re[b] * re[b] + im[b] * im[b] + 1e-12);
    }
    pickPeaks(logMag, f, peaks);
  }
  return { peaks, frameCount };
}

// ---------------------------------------------------------------------------
// ピーク → ハッシュ
// ---------------------------------------------------------------------------

function pairHashes(peaks: Peak[]): Hash[] {
  const hashes: Hash[] = [];
  // peaks はフレーム順に並んでいる
  for (let i = 0; i < peaks.length; i++) {
    const a = peaks[i];
    let paired = 0;
    for (let j = i + 1; j < peaks.length && paired < FANOUT; j++) {
      const b = peaks[j];
      const dt = b.frame - a.frame;
      if (dt <= 0) continue;
      if (dt > MAX_PAIR_DT) break;
      hashes.push({ code: ((a.bin & 0x1ff) << 15) | ((b.bin & 0x1ff) << 6) | (dt & 0x3f), frame: a.frame });
      paired++;
    }
  }
  return hashes;
}

/** PCM（8kHz モノラル・-1..1）から指紋を作る */
export function fingerprint(samples: Float32Array): Fingerprint {
  const { peaks, frameCount } = spectrogramPeaks(samples);
  return {
    hashes: pairHashes(peaks),
    frameCount,
    durationSec: samples.length / FINGERPRINT_SAMPLE_RATE,
  };
}

// ---------------------------------------------------------------------------
// 照合
// ---------------------------------------------------------------------------

export interface TrackIndex {
  byCode: Map<number, number[]>;
  frameCount: number;
}

/** 探される側（提出動画・見本）の索引を作る */
export function buildTrackIndex(fp: Fingerprint): TrackIndex {
  const byCode = new Map<number, number[]>();
  for (const h of fp.hashes) {
    const list = byCode.get(h.code);
    if (list) list.push(h.frame);
    else byCode.set(h.code, [h.frame]);
  }
  return { byCode, frameCount: fp.frameCount };
}

export interface ClipMatch {
  /** クリップの先頭がトラック上で始まる秒 */
  startSec: number;
  /** 一致したハッシュ数 ÷ クリップのハッシュ数（0..1） */
  score: number;
  /** クリップの時間軸のうち、一致が見つかった割合（0..1） */
  coverage: number;
  matchedHashes: number;
}

export interface MatchOptions {
  /** 一致とみなす最低スコア */
  minScore?: number;
  /** 一致とみなす最低カバー率 */
  minCoverage?: number;
  /** 返す候補の最大数（同じクリップが複数回使われている検出用） */
  maxMatches?: number;
}

/**
 * 一致とみなす最低スコア。投票は ±1 フレームの揺れを合算するため、同一音源なら 1 を超え、
 * 別の音源どうしは合成信号でも 0.2 未満に収まる（fingerprint.test.ts の分布より）。
 */
export const DEFAULT_MIN_SCORE = 0.25;
export const DEFAULT_MIN_COVERAGE = 0.5;
/** 2回目以降の一致は、最良の一致に対してこの比率以上のスコアが必要（同じクリップの重複使用の検出用） */
const SECONDARY_MATCH_RATIO = 0.4;
/** カバー率の計算単位（秒） */
const COVERAGE_BIN_SEC = 0.5;

/**
 * クリップがトラックのどこにあるかを探す。複数回入っていれば複数返す（スコア順）。
 * 見つからなければ空配列。
 */
export function findClipInTrack(clip: Fingerprint, track: TrackIndex, options: MatchOptions = {}): ClipMatch[] {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const minCoverage = options.minCoverage ?? DEFAULT_MIN_COVERAGE;
  const maxMatches = options.maxMatches ?? 3;
  if (clip.hashes.length === 0 || track.frameCount === 0) return [];

  // offset（トラック時刻 − クリップ時刻）ごとの投票。負の offset も許す（クリップ先頭が切られている場合）
  const base = clip.frameCount;
  const votes = new Int32Array(track.frameCount + base + 1);
  const matchedClipFrames: number[][] = []; // offset → クリップ側フレーム一覧（カバー率計算用）
  for (const h of clip.hashes) {
    const frames = track.byCode.get(h.code);
    if (!frames) continue;
    for (const tf of frames) {
      const offset = tf - h.frame + base;
      if (offset < 0 || offset >= votes.length) continue;
      votes[offset]++;
      (matchedClipFrames[offset] ??= []).push(h.frame);
    }
  }

  const clipBins = Math.max(1, Math.ceil(clip.durationSec / COVERAGE_BIN_SEC));
  const results: ClipMatch[] = [];
  const suppressed = new Uint8Array(votes.length);

  for (let n = 0; n < maxMatches; n++) {
    let bestOffset = -1;
    let bestVotes = 0;
    for (let o = 0; o < votes.length; o++) {
      if (suppressed[o]) continue;
      let v = 0;
      for (let d = -OFFSET_SLACK; d <= OFFSET_SLACK; d++) {
        const idx = o + d;
        if (idx >= 0 && idx < votes.length) v += votes[idx];
      }
      if (v > bestVotes) {
        bestVotes = v;
        bestOffset = o;
      }
    }
    if (bestOffset < 0) break;

    const score = bestVotes / clip.hashes.length;
    const covered = new Uint8Array(clipBins);
    for (let d = -OFFSET_SLACK; d <= OFFSET_SLACK; d++) {
      for (const cf of matchedClipFrames[bestOffset + d] ?? []) {
        const bin = Math.min(clipBins - 1, Math.floor((cf * FRAME_SEC) / COVERAGE_BIN_SEC));
        covered[bin] = 1;
      }
    }
    let coveredCount = 0;
    for (let i = 0; i < clipBins; i++) coveredCount += covered[i];
    const coverage = coveredCount / clipBins;

    if (score < minScore || coverage < minCoverage) break;
    if (results.length > 0 && score < results[0].score * SECONDARY_MATCH_RATIO) break;

    results.push({
      startSec: (bestOffset - base) * FRAME_SEC,
      score,
      coverage,
      matchedHashes: bestVotes,
    });

    // 同じ場所の再検出を防ぐため、クリップ長ぶん前後を候補から外す
    const lo = Math.max(0, bestOffset - clip.frameCount);
    const hi = Math.min(votes.length - 1, bestOffset + clip.frameCount);
    for (let o = lo; o <= hi; o++) suppressed[o] = 1;
  }

  return results;
}
