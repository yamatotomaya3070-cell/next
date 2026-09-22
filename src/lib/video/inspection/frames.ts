import type { CheckItem } from "./types";
import { formatSec, voiceDisplayName } from "./structure";

/**
 * 見本フレーム照合（純関数）。
 *
 * 提出動画と完成見本の「同じ場面」のフレーム（縮小グレースケール）を比べ、
 *   - 冒頭のオープニング／末尾のエンディングが見本と同じか
 *   - 各場面の映像が見本と同じか（違う素材を置いていないか）
 *   - 字幕の位置・大きさが見本と同じか
 * を項目別の pass/fail にする。
 *
 * 類似度は「平均を引いた正規化相関」なので、明るさや再エンコードの差には強く、
 * 別の場面の映像なら大きく下がる。判定は保守的で、
 * 「明らかに違う」ときだけ fail、微妙なときは unknown（職員に見てもらう）にする。
 */

export interface GrayFrame {
  width: number;
  height: number;
  /** 行優先の輝度 0..255（width*height 個） */
  data: Uint8Array;
}

/** これ以上なら「同じ映像」 */
export const FRAME_SAME_SIMILARITY = 0.75;
/** これ未満なら「明らかに違う映像」 */
export const FRAME_DIFFERENT_SIMILARITY = 0.45;

/** 両方とも一様（真っ黒など）なときに「同じ」とみなす平均輝度の差 */
const FLAT_FRAME_MEAN_TOLERANCE = 16;

/** 平均を引いた正規化相関（-1〜1）。同じ映像なら 1 に近づく */
export function frameSimilarity(a: GrayFrame, b: GrayFrame): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`フレームの大きさが違います: ${a.width}x${a.height} と ${b.width}x${b.height}`);
  }
  const n = a.data.length;
  if (n === 0) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a.data[i];
    meanB += b.data[i];
  }
  meanA /= n;
  meanB /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a.data[i] - meanA;
    const db = b.data[i] - meanB;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  if (saa === 0 || sbb === 0) {
    // 片方または両方が一様。両方一様で明るさも近ければ同じ（例: 黒画面どうし）
    return saa === 0 && sbb === 0 && Math.abs(meanA - meanB) <= FLAT_FRAME_MEAN_TOLERANCE ? 1 : 0;
  }
  return sab / Math.sqrt(saa * sbb);
}

/** フレームの一部（行の範囲）を切り出す */
export function sliceRows(frame: GrayFrame, fromRow: number, toRow: number): GrayFrame {
  const from = Math.max(0, Math.min(frame.height, fromRow));
  const to = Math.max(from, Math.min(frame.height, toRow));
  return { width: frame.width, height: to - from, data: frame.data.subarray(from * frame.width, to * frame.width) };
}

// ---------------------------------------------------------------------------
// 映像の照合
// ---------------------------------------------------------------------------

export type FrameAnchorKind = "opening" | "ending" | "scene";

export interface FrameObservation {
  kind: FrameAnchorKind;
  /** 場面の記号（S06）。opening/ending は "オープニング"/"エンディング" */
  scene: string;
  /** 提出動画の秒（利用者への案内用） */
  submissionSec: number;
  /** 見本フレームと、提出動画の前後数フレームとの類似度の最大 */
  similarity: number;
}

function classify(similarity: number): "same" | "different" | "doubtful" {
  if (similarity >= FRAME_SAME_SIMILARITY) return "same";
  if (similarity < FRAME_DIFFERENT_SIMILARITY) return "different";
  return "doubtful";
}

function edgeItem(kind: "opening" | "ending", obs: FrameObservation[]): CheckItem {
  const label = kind === "opening" ? "冒頭のオープニング" : "末尾のエンディング";
  const key = kind === "opening" ? "frame_opening" : "frame_ending";
  const expected = "見本と同じ映像";
  if (obs.length === 0) {
    return { key, label, status: "unknown", expected, actual: "確認できませんでした" };
  }
  const classes = obs.map((o) => classify(o.similarity));
  const minSim = Math.min(...obs.map((o) => o.similarity));
  if (classes.every((c) => c === "same")) {
    return { key, label, status: "pass", expected, actual: `見本と同じ（類似度 ${minSim.toFixed(2)}）` };
  }
  if (classes.every((c) => c === "different")) {
    const where = kind === "opening" ? "動画の最初" : "動画の最後";
    const asset = kind === "opening" ? "オープニング" : "エンディング";
    return {
      key,
      label,
      status: "fail",
      expected,
      actual: `見本と違う映像（類似度 ${minSim.toFixed(2)}）`,
      message: `${where}の${asset}が見本と違います。支給素材の${asset}を${kind === "opening" ? "先頭" : "末尾"}に置いてください。`,
    };
  }
  return { key, label, status: "unknown", expected, actual: `見本と少し違うかもしれません（類似度 ${minSim.toFixed(2)}）` };
}

function sceneItem(obs: FrameObservation[]): CheckItem {
  const key = "frame_scene";
  const label = "場面の映像";
  const expected = "すべての場面が見本と同じ映像";
  if (obs.length === 0) {
    return { key, label, status: "unknown", expected, actual: "確認できませんでした" };
  }
  const byScene = new Map<string, FrameObservation[]>();
  for (const o of obs) byScene.set(o.scene, [...(byScene.get(o.scene) ?? []), o]);

  const different: string[] = [];
  const doubtful: string[] = [];
  for (const [scene, items] of byScene) {
    const classes = items.map((o) => classify(o.similarity));
    const at = Math.min(...items.map((o) => o.submissionSec));
    if (classes.every((c) => c === "different")) different.push(`${scene}（${formatSec(at)}あたり）`);
    else if (classes.some((c) => c !== "same")) doubtful.push(`${scene}（${formatSec(at)}あたり）`);
  }
  const sceneCount = byScene.size;
  if (different.length > 0) {
    return {
      key,
      label,
      status: "fail",
      expected,
      actual: `見本と違う場面: ${different.join("、")}`,
      message: `場面 ${different.join("、")} の映像が見本と違います。その場面の支給素材（映像）を置き直してください。`,
    };
  }
  if (doubtful.length > 0) {
    return { key, label, status: "unknown", expected, actual: `少し違うかもしれない場面: ${doubtful.join("、")}` };
  }
  return { key, label, status: "pass", expected, actual: `${sceneCount}場面すべて見本と同じ` };
}

export function checkFrames(observations: FrameObservation[]): CheckItem[] {
  return [
    edgeItem("opening", observations.filter((o) => o.kind === "opening")),
    edgeItem("ending", observations.filter((o) => o.kind === "ending")),
    sceneItem(observations.filter((o) => o.kind === "scene")),
  ];
}

// ---------------------------------------------------------------------------
// 字幕の位置・大きさ
// ---------------------------------------------------------------------------

/** 字幕の文字とみなす輝度（白文字） */
export const TEXT_BRIGHTNESS = 225;
/** 文字の行とみなす、明るい画素の幅に対する割合（薄く明るい図形の縁を文字と間違えないよう少し高めにする） */
const TEXT_ROW_MIN_RATIO = 0.03;
/** 文字行のかたまりを1つにまとめるときに許す空き行（帯の高さに対する割合。2行字幕の行間を吸収する） */
const TEXT_ROW_GAP_RATIO = 0.06;
/** 帯のこの割合を超えて明るい行が続くなら、字幕ではなく背景が明るいので判定しない */
const TEXT_ROWS_MAX_RATIO = 0.7;

/** フレーム全体の高さに対する 0..1 の位置 */
export interface TextBand {
  top: number;
  bottom: number;
}

/**
 * 字幕帯（フレーム下部の切り出し）から、白い文字の行の範囲を見つける。
 * bandTop/bandHeight は帯がフレーム全体のどこにあるか（0..1）。
 * 見つからない・判定できないときは null。
 */
export function detectTextBand(band: GrayFrame, bandTop: number, bandHeight: number): TextBand | null {
  const minBright = Math.max(1, Math.round(band.width * TEXT_ROW_MIN_RATIO));
  const brightCounts: number[] = [];
  for (let y = 0; y < band.height; y++) {
    let bright = 0;
    const base = y * band.width;
    for (let x = 0; x < band.width; x++) if (band.data[base + x] >= TEXT_BRIGHTNESS) bright++;
    brightCounts.push(bright);
  }
  // 連続する文字行のかたまり（小さな空きは許す）のうち、明るい画素の合計が一番多いものを採る
  // （薄く明るい図形の縁が長く続いても、文字の太い白より合計は小さい）
  const maxGap = Math.max(1, Math.round(band.height * TEXT_ROW_GAP_RATIO));
  let best: { from: number; to: number; mass: number } | null = null;
  let cur: { from: number; to: number; mass: number } | null = null;
  let gap = 0;
  for (let y = 0; y < band.height; y++) {
    if (brightCounts[y] >= minBright) {
      if (cur && gap <= maxGap) cur = { from: cur.from, to: y, mass: cur.mass + brightCounts[y] };
      else cur = { from: y, to: y, mass: brightCounts[y] };
      gap = 0;
      if (!best || cur.mass > best.mass) best = cur;
    } else {
      gap++;
    }
  }
  if (!best) return null;
  const rows = best.to - best.from + 1;
  if (rows > band.height * TEXT_ROWS_MAX_RATIO) return null;
  const scale = bandHeight / band.height;
  return { top: bandTop + best.from * scale, bottom: bandTop + (best.to + 1) * scale };
}

/** 字幕の中心位置がこれ以上ずれていたら「違う」（フレーム高さに対する割合） */
export const TELOP_POSITION_TOLERANCE = 0.06;
/** 字幕の高さの比がこの範囲を外れたら「違う」 */
export const TELOP_HEIGHT_RATIO_RANGE: readonly [number, number] = [0.6, 1.6];
/** fail にするのに必要な「違う」セリフの数と割合 */
const TELOP_STYLE_MIN_OFF = 3;
const TELOP_STYLE_MIN_OFF_RATIO = 0.5;

export interface TelopStyleObservation {
  /** セリフ音声ファイル名（S06_03_ミナ先生.wav） */
  voiceFile: string;
  submissionSec: number;
  sample: TextBand | null;
  submission: TextBand | null;
}

export function isTelopStyleOff(sample: TextBand, submission: TextBand): boolean {
  const centerDiff = Math.abs((sample.top + sample.bottom) / 2 - (submission.top + submission.bottom) / 2);
  if (centerDiff > TELOP_POSITION_TOLERANCE) return true;
  const hs = sample.bottom - sample.top;
  const hb = submission.bottom - submission.top;
  if (hs <= 0 || hb <= 0) return true;
  const ratio = hb / hs;
  return ratio < TELOP_HEIGHT_RATIO_RANGE[0] || ratio > TELOP_HEIGHT_RATIO_RANGE[1];
}

export function checkTelopStyle(observations: TelopStyleObservation[]): CheckItem {
  const key = "telop_style";
  const label = "字幕の位置・大きさ";
  const expected = "見本と同じ位置・大きさ";
  const evaluable = observations.filter((o) => o.sample && o.submission) as Array<
    TelopStyleObservation & { sample: TextBand; submission: TextBand }
  >;
  if (evaluable.length < TELOP_STYLE_MIN_OFF) {
    return { key, label, status: "unknown", expected, actual: "確認できませんでした（字幕の位置を読み取れたセリフが少ない）" };
  }
  const off = evaluable.filter((o) => isTelopStyleOff(o.sample, o.submission));
  if (off.length === 0) {
    return { key, label, status: "pass", expected, actual: `${evaluable.length}本すべて見本どおり` };
  }
  const first = off[0];
  const example = `${voiceDisplayName(first.voiceFile)}: ${formatSec(first.submissionSec)}あたり`;
  if (off.length >= TELOP_STYLE_MIN_OFF && off.length >= evaluable.length * TELOP_STYLE_MIN_OFF_RATIO) {
    return {
      key,
      label,
      status: "fail",
      expected,
      actual: `${evaluable.length}本中 ${off.length}本が見本と違う位置・大きさ（例: ${example}）`,
      message: `字幕の位置または大きさが見本と違います（例: ${example}）。見本と同じ位置・大きさにそろえてください。`,
    };
  }
  return { key, label, status: "unknown", expected, actual: `${evaluable.length}本中 ${off.length}本が少し違うかもしれません（例: ${example}）` };
}
