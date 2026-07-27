/**
 * 実写Bロール背景動画のビルダー（マイルストーン2の中核）。
 *
 * 役割: キーワードでストック動画を検索→ダウンロード→WxHへcover正規化→複数クリップを
 *       テンポよく連結し、指定尺を満たす「背景動画」(broll_background.mp4) を1本作る。
 *       render.ts はこれを従来の静止画背景の代わりに敷き、上にテロップ・字幕・話者名を重ねる。
 *       → 「スライド合成のゆっくり解説風」から「実写Bロール＋テロップのYouTube風」へ。
 *
 * ライセンス: 使用クリップを credits として返し、呼び出し側が撮影者/提供元を素材へ同梱する。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getStockProvider,
  pickVideoFile,
  type StockClip,
  type StockOrientation,
} from "../../src/lib/video/stock";
import { downloadStockFile } from "./stock";
import { run } from "./exec";

const FPS = 30;
// 1クリップあたりの採用秒数。短めに切ってテンポよく切り替える（実務のBロール感）。
const PER_CLIP_MAX_SEC = 6;
const PER_CLIP_MIN_SEC = 3;
const SEARCH_PER_PAGE = 10;
// 背景に使わない「ダミー素材」の本数。就労者が素材を選別する練習のため、
// 支給素材にわざと余分なクリップを混ぜる。
const DISTRACTOR_COUNT = 2;

/** WxH正規化済みの1クリップ（背景に使う/使わないを保持） */
export interface BrollSegment {
  path: string; // 正規化済みmp4の絶対パス
  clip: StockClip; // 出典（クレジット用）
  usedInBackground: boolean; // 完成見本の背景に使ったか（false=ダミー素材）
}

export interface BrollResult {
  backgroundPath: string; // 生成した背景動画の絶対パス
  segments: BrollSegment[]; // 背景採用分＋ダミー素材（支給素材ZIPに同梱する）
  credits: StockClip[]; // 全クリップ（クレジット表記用）
}

export interface BrollOptions {
  keywords: string[];
  totalDurationSec: number;
  width: number;
  height: number;
  orientation: StockOrientation;
  outPath: string; // 出力先（絶対パス）
  tmpDir: string; // ダウンロード・中間セグメント用（絶対パス）
}

/** ストック検索で重複を除いたクリップ一覧を集める */
async function collectClips(
  keywords: string[],
  orientation: StockOrientation,
): Promise<StockClip[]> {
  const provider = getStockProvider();
  const clips: StockClip[] = [];
  const seen = new Set<string>();
  for (const keyword of keywords) {
    const found = await provider.searchVideos(keyword, {
      orientation,
      perPage: SEARCH_PER_PAGE,
      minDurationSec: PER_CLIP_MIN_SEC,
    });
    for (const clip of found) {
      if (!seen.has(clip.id)) {
        seen.add(clip.id);
        clips.push(clip);
      }
    }
  }
  return clips;
}

/** 1クリップをDL→WxHへcover正規化した無音mp4にする。失敗時はnull。返すのはcwd相対名。 */
async function normalizeClip(
  clip: StockClip,
  index: number,
  width: number,
  height: number,
  tmpDir: string,
): Promise<{ name: string; seconds: number } | null> {
  const file = pickVideoFile(clip, width, height);
  if (!file) return null;
  const rawPath = join(tmpDir, `raw_${clip.id}.mp4`);
  try {
    await downloadStockFile(file.link, rawPath);
  } catch {
    return null;
  }
  const seconds = Math.min(PER_CLIP_MAX_SEC, Math.max(PER_CLIP_MIN_SEC, clip.durationSec));
  const name = `seg_${String(index).padStart(3, "0")}.mp4`;
  run(
    "ffmpeg",
    [
      "-y", "-t", seconds.toFixed(2), "-i", rawPath,
      "-an",
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},fps=${FPS},format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      name,
    ],
    tmpDir,
  );
  return { name, seconds };
}

export async function buildBrollBackground(opts: BrollOptions): Promise<BrollResult> {
  const { keywords, totalDurationSec, width, height, orientation, outPath, tmpDir } = opts;
  mkdirSync(tmpDir, { recursive: true });

  const clips = await collectClips(keywords, orientation);
  if (clips.length === 0) {
    throw new Error(`Bロール用クリップが見つかりません（keywords: ${keywords.join(", ")}）`);
  }

  // 1. 目標尺を満たすまで、背景採用クリップを正規化していく
  const segments: BrollSegment[] = [];
  const bgSegmentNames: string[] = [];
  let accumulated = 0;
  for (const clip of clips) {
    if (accumulated >= totalDurationSec) break;
    const seg = await normalizeClip(clip, segments.length, width, height, tmpDir);
    if (!seg) continue;
    bgSegmentNames.push(seg.name);
    segments.push({ path: join(tmpDir, seg.name), clip, usedInBackground: true });
    accumulated += seg.seconds;
  }
  if (segments.length === 0) {
    throw new Error("Bロールのセグメントを1つも生成できませんでした（DL失敗が続いた可能性）");
  }

  // 2. ダミー素材（背景に使わない）を数本追加する＝就労者が素材を選別する練習になる
  const usedIds = new Set(segments.map((s) => s.clip.id));
  const distractors = clips.filter((c) => !usedIds.has(c.id)).slice(0, DISTRACTOR_COUNT);
  for (const clip of distractors) {
    const seg = await normalizeClip(clip, segments.length, width, height, tmpDir);
    if (!seg) continue;
    segments.push({ path: join(tmpDir, seg.name), clip, usedInBackground: false });
  }

  // 3. 背景採用分のみ連結（同一エンコードなので copy 連結。尺不足は後段の -stream_loop で吸収）
  writeFileSync(
    join(tmpDir, "concat.txt"),
    bgSegmentNames.map((n) => `file '${n}'`).join("\n"),
    "utf8",
  );
  run(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", outPath],
    tmpDir,
  );

  return { backgroundPath: outPath, segments, credits: segments.map((s) => s.clip) };
}
