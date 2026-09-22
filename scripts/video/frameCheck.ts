/**
 * 見本フレーム照合の実行（ffmpeg に依存するためワーカー側に置く）。
 *
 * 構成照合（structureCheck）で分かった「見本と提出動画の中で各セリフが始まる秒」を使って
 * 同じ場面のフレームを両方から取り出し、frames.ts の純関数で
 *   - 冒頭のオープニング／末尾のエンディング
 *   - 各場面の映像（場面ごとに最初と最後のセリフの真ん中）
 *   - 字幕の位置・大きさ
 * を照合する。
 *
 * フレームの取り出しは、動画を1回だけデコードして 2fps・640x360 のグレースケールを流し、
 * 必要な時刻のものだけを拾う（完成見本はキーフレームが少なく、1枚ずつのシークが遅いため）。
 * 上 70% を映像、下 30% を字幕帯として使う。
 */
import { spawn } from "node:child_process";
import {
  checkFrames,
  checkTelopStyle,
  detectTextBand,
  frameSimilarity,
  sliceRows,
  type FrameObservation,
  type GrayFrame,
  type TelopStyleObservation,
  type TextBand,
} from "../../src/lib/video/inspection/frames";

/** 字幕の位置の近さ（中心のずれ＋高さの差）。見本側が無ければ比べようがないので 0 */
function bandDistance(sample: TextBand | null, band: TextBand): number {
  if (!sample) return 0;
  const centerDiff = Math.abs((sample.top + sample.bottom) / 2 - (band.top + band.bottom) / 2);
  const heightDiff = Math.abs(sample.bottom - sample.top - (band.bottom - band.top));
  return centerDiff + heightDiff;
}
import type { CheckItem } from "../../src/lib/video/inspection/types";
import type { VoiceMatchDetail } from "./structureCheck";

export const FRAME_WIDTH = 640;
export const FRAME_HEIGHT = 360;
/** 取り出すフレームの間隔（1秒あたりの枚数）。時刻はこの格子に丸める */
export const FRAME_FPS = 2;
/** 字幕帯（フレームの下から何割か）。telopOcr.ts の STRIP_HEIGHT_RATIO と同じ */
export const SUBTITLE_BAND_RATIO = 0.3;
/** 提出動画側で試す時間のずれ（秒）。配置の多少のズレを許す */
const SUBMISSION_OFFSETS_SEC = [-1, -0.5, 0, 0.5, 1] as const;
/** オープニング／エンディングを撮る位置（先頭から／末尾から の秒） */
const OPENING_ANCHORS_SEC = [1.0, 3.0] as const;
const ENDING_ANCHORS_FROM_END_SEC = [1.5, 3.5] as const;
/** 短い動画で末尾アンカーが先頭と重ならないための最短の長さ */
const MIN_DURATION_FOR_EDGES_SEC = 8;

/** 秒 → 取り出し格子の番号（fps=2 なら 0.5 秒刻み） */
export function gridIndex(sec: number, fps = FRAME_FPS): number {
  return Math.max(0, Math.round(sec * fps));
}

/**
 * 動画を1回デコードし、wantedSec の時刻（格子に丸めた番号）のフレームだけを返す。
 * 動画の長さを超える時刻は含まれない（呼び出し側で無視する）。
 */
export function extractGrayFramesAt(
  file: string,
  cwd: string,
  wantedSec: number[],
  fps = FRAME_FPS,
): Promise<Map<number, GrayFrame>> {
  const wanted = new Set(wantedSec.map((s) => gridIndex(s, fps)));
  const out = new Map<number, GrayFrame>();
  if (wanted.size === 0) return Promise.resolve(out);
  const maxIndex = Math.max(...wanted);
  const frameBytes = FRAME_WIDTH * FRAME_HEIGHT;

  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ffmpeg",
      [
        "-v", "error",
        "-i", file,
        "-an",
        "-vf", `fps=${fps},scale=${FRAME_WIDTH}:${FRAME_HEIGHT}`,
        "-f", "rawvideo",
        "-pix_fmt", "gray",
        "-",
      ],
      { cwd, stdio: ["ignore", "pipe", "pipe"] },
    );
    let pending: Buffer = Buffer.alloc(0);
    let index = 0;
    let stderr = "";
    let stoppedEarly = false;

    proc.stdout.on("data", (chunk: Buffer) => {
      if (stoppedEarly) return;
      pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
      while (pending.length >= frameBytes) {
        if (wanted.has(index)) {
          out.set(index, { width: FRAME_WIDTH, height: FRAME_HEIGHT, data: new Uint8Array(pending.subarray(0, frameBytes)) });
        }
        pending = pending.subarray(frameBytes);
        index++;
        if (index > maxIndex) {
          // 必要な分は取れたので、残りのデコードは打ち切る
          stoppedEarly = true;
          proc.kill();
          break;
        }
      }
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    proc.on("error", (err) => reject(new Error(`ffmpeg の実行に失敗しました（${file}）: ${err.message}`)));
    proc.on("close", (code) => {
      if (!stoppedEarly && code !== 0) {
        reject(new Error(`${file} のフレーム取り出しに失敗しました（code ${code}）: ${stderr.slice(-300)}`));
        return;
      }
      resolve(out);
    });
  });
}

const VIDEO_ROWS = Math.round(FRAME_HEIGHT * (1 - SUBTITLE_BAND_RATIO));

/** 字幕帯を除いた映像部分 */
export function videoRegion(frame: GrayFrame): GrayFrame {
  return sliceRows(frame, 0, VIDEO_ROWS);
}

/** 字幕帯 */
export function subtitleRegion(frame: GrayFrame): GrayFrame {
  return sliceRows(frame, VIDEO_ROWS, FRAME_HEIGHT);
}

export interface FrameCheckInput {
  workdir: string;
  sampleFile: string;
  submissionFile: string;
  sampleDurationSec: number;
  submissionDurationSec: number;
  /** 構成照合の結果（セリフごとの見本・提出動画内の位置と長さ） */
  voices: VoiceMatchDetail[];
}

export interface FrameCheckResult {
  checks: CheckItem[];
  frames: FrameObservation[];
  styles: TelopStyleObservation[];
  /** 照合をしなかった理由（ログ・職員向け） */
  skippedReason: string | null;
}

interface Anchor {
  kind: FrameObservation["kind"];
  scene: string;
  /** 字幕の位置も見るときのセリフ名（場面アンカーのみ） */
  voiceFile: string | null;
  sampleSec: number;
  submissionSec: number;
}

/** S06_03_ミナ先生.wav → S06 */
function sceneOf(voiceFile: string): string {
  const m = /^(S\d{2})_/i.exec(voiceFile);
  return m ? m[1].toUpperCase() : voiceFile;
}

function edgeAnchors(input: FrameCheckInput): Anchor[] {
  if (input.sampleDurationSec < MIN_DURATION_FOR_EDGES_SEC || input.submissionDurationSec < MIN_DURATION_FOR_EDGES_SEC) return [];
  const opening = OPENING_ANCHORS_SEC.map<Anchor>((sec) => ({
    kind: "opening",
    scene: "オープニング",
    voiceFile: null,
    sampleSec: sec,
    submissionSec: sec,
  }));
  const ending = ENDING_ANCHORS_FROM_END_SEC.map<Anchor>((fromEnd) => ({
    kind: "ending",
    scene: "エンディング",
    voiceFile: null,
    sampleSec: input.sampleDurationSec - fromEnd,
    submissionSec: input.submissionDurationSec - fromEnd,
  }));
  return [...opening, ...ending];
}

/** 場面ごとに、見本と提出の両方で見つかった最初と最後のセリフをアンカーにする */
export function sceneAnchors(voices: VoiceMatchDetail[]): Anchor[] {
  const usable = voices
    .filter((v) => v.inSample && v.inSubmission.length > 0)
    .map((v) => ({
      voiceFile: v.name,
      scene: sceneOf(v.name),
      sampleStart: v.inSample!.startSec,
      submissionStart: Math.min(...v.inSubmission.map((m) => m.startSec)),
      mid: Math.max(0.3, v.durationSec / 2),
    }))
    .sort((a, b) => a.sampleStart - b.sampleStart);
  const byScene = new Map<string, typeof usable>();
  for (const u of usable) byScene.set(u.scene, [...(byScene.get(u.scene) ?? []), u]);
  const anchors: Anchor[] = [];
  for (const items of byScene.values()) {
    const picks = items.length === 1 ? [items[0]] : [items[0], items[items.length - 1]];
    for (const p of picks) {
      anchors.push({
        kind: "scene",
        scene: p.scene,
        voiceFile: p.voiceFile,
        sampleSec: p.sampleStart + p.mid,
        submissionSec: p.submissionStart + p.mid,
      });
    }
  }
  return anchors;
}

export async function runFrameCheck(input: FrameCheckInput): Promise<FrameCheckResult> {
  const anchors = [...edgeAnchors(input), ...sceneAnchors(input.voices)];
  if (anchors.length === 0) {
    const reason = "見本と提出動画で対応づけられる場面が無いため映像は確認していません";
    return { checks: checkFrames([]).map((c) => ({ ...c, actual: reason })), frames: [], styles: [], skippedReason: reason };
  }

  const clampSub = (sec: number) => Math.min(Math.max(0, sec), Math.max(0, input.submissionDurationSec - 0.1));
  const submissionTimes = anchors.flatMap((a) => SUBMISSION_OFFSETS_SEC.map((off) => clampSub(a.submissionSec + off)));
  const [sampleFrames, submissionFrames] = await Promise.all([
    extractGrayFramesAt(input.sampleFile, input.workdir, anchors.map((a) => a.sampleSec)),
    extractGrayFramesAt(input.submissionFile, input.workdir, submissionTimes),
  ]);

  const frames: FrameObservation[] = [];
  const styles: TelopStyleObservation[] = [];
  const bandTop = 1 - SUBTITLE_BAND_RATIO;

  for (const a of anchors) {
    const sampleFrame = sampleFrames.get(gridIndex(a.sampleSec));
    if (!sampleFrame) continue;
    const sampleVideo = videoRegion(sampleFrame);
    let best = -1;
    for (const off of SUBMISSION_OFFSETS_SEC) {
      const subFrame = submissionFrames.get(gridIndex(clampSub(a.submissionSec + off)));
      if (!subFrame) continue;
      best = Math.max(best, frameSimilarity(sampleVideo, videoRegion(subFrame)));
    }
    if (best < 0) continue;
    frames.push({ kind: a.kind, scene: a.scene, submissionSec: a.submissionSec, similarity: best });

    // 字幕の位置。時刻の格子（0.5秒）のずれで字幕の切り替わりの瞬間を拾うことがあるので、
    // 提出側は前後のフレームのうち見本に一番近い位置のものを採る
    if (a.voiceFile) {
      const sampleBand = detectTextBand(subtitleRegion(sampleFrame), bandTop, SUBTITLE_BAND_RATIO);
      let submissionBand: TextBand | null = null;
      for (const off of SUBMISSION_OFFSETS_SEC) {
        const subFrame = submissionFrames.get(gridIndex(clampSub(a.submissionSec + off)));
        if (!subFrame) continue;
        const band = detectTextBand(subtitleRegion(subFrame), bandTop, SUBTITLE_BAND_RATIO);
        if (band && (!submissionBand || bandDistance(sampleBand, band) < bandDistance(sampleBand, submissionBand))) {
          submissionBand = band;
        }
      }
      styles.push({ voiceFile: a.voiceFile, submissionSec: a.submissionSec, sample: sampleBand, submission: submissionBand });
    }
  }

  return { checks: [...checkFrames(frames), checkTelopStyle(styles)], frames, styles, skippedReason: null };
}
