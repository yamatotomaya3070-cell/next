/**
 * 「わざとミスを入れた提出動画」を完成見本から ffmpeg で作る。
 * 各変種は「どの検品項目が NG になるべきか（expectedFails）」を持ち、
 * スモークテストと精度測定（measure-inspection-accuracy）で使う。
 *
 * 提出動画は必ず再エンコードする（就労者の書き出しと同じく、見本と同一ファイルではない）。
 */
import { run } from "./exec";
import { SUBTITLE_BAND_RATIO } from "./frameCheck";
import type { VoiceMatchDetail } from "./structureCheck";

/** 検品項目のキー（CheckItem.key） */
export const CHECK_KEYS = {
  duration: "duration",
  resolution: "resolution",
  volume: "volume",
  voicePresent: "voice_present",
  voiceDuplicate: "voice_duplicate",
  voiceOrder: "voice_order",
  voiceSpacing: "voice_spacing",
  telopPresent: "telop_present",
  telopText: "telop_text",
  frameOpening: "frame_opening",
  frameEnding: "frame_ending",
  frameScene: "frame_scene",
  telopStyle: "telop_style",
} as const;

export interface VariantSpec {
  id: string;
  title: string;
  /** NG になるべき項目 */
  expectedFails: string[];
  /** NG になっても誤検知に数えない項目（加工の副作用で本当に間違いになる項目） */
  allowedExtra: string[];
  /** 出力ファイルを作る */
  build: (out: string) => void;
}

export interface VariantContext {
  sampleAbs: string;
  cwd: string;
  sampleDurationSec: number;
  width: number;
  height: number;
  /** 見本そのものを検品したときの構成照合の結果（セリフの位置） */
  voices: VoiceMatchDetail[];
}

const ENCODE = ["-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac"];
/** 支給素材のオープニング／エンディングの長さ（assets/video/opening.mp4 = 3.2秒、ending.mp4 = 7.43秒） */
export const OPENING_SEC = 3.2;
export const ENDING_SEC = 7.43;
/** エンディング欠落の変種を作るのに必要な、最後のセリフの後ろの余白（秒） */
const MIN_TAIL_CUT_SEC = 2;
/** 挿入する無音・黒画面の長さ。セリフ間隔の許容（1.5秒）を明らかに超える */
const GAP_INSERT_SEC = 4;
const VOLUME_DROP_DB = 12;
const TELOP_MOVE_RATIO = 0.1;
const FONT_FILE = "C\\:/Windows/Fonts/meiryo.ttc";

/** concat で継ぎ目の形式を揃えるためのフィルタ */
function vNorm(ctx: VariantContext): string {
  return `scale=${ctx.width}:${ctx.height},fps=24,format=yuv420p,setsar=1`;
}
const A_NORM = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";

function ffmpeg(args: string[], cwd: string): void {
  run("ffmpeg", ["-y", ...args], cwd);
}

/** 区間 [a,b) の映像と音声を切り出すフィルタ（ラベル付き） */
function segment(ctx: VariantContext, from: number, to: number | null, v: string, a: string): string {
  const range = to === null ? `${from}` : `${from}:${to}`;
  return `[0:v]trim=${range},setpts=PTS-STARTPTS,${vNorm(ctx)}[${v}];[0:a]atrim=${range},asetpts=PTS-STARTPTS,${A_NORM}[${a}]`;
}

/** 見本をそのまま再エンコード（品質を落とす） */
export function makeReencode(ctx: VariantContext, out: string, crf: number): void {
  ffmpeg(["-i", ctx.sampleAbs, ...ENCODE, "-crf", String(crf), out], ctx.cwd);
}

/** 解像度を変える */
export function makeScaled(ctx: VariantContext, out: string, width: number, height: number): void {
  ffmpeg(["-i", ctx.sampleAbs, "-vf", `scale=${width}:${height}`, ...ENCODE, out], ctx.cwd);
}

/** 音量を下げる */
export function makeQuiet(ctx: VariantContext, out: string, dropDb: number): void {
  ffmpeg(["-i", ctx.sampleAbs, "-af", `volume=-${dropDb}dB`, ...ENCODE, out], ctx.cwd);
}

/** [cutStart, cutEnd) を切り落とす */
export function makeCut(ctx: VariantContext, out: string, cutStart: number, cutEnd: number, src = ctx.sampleAbs): void {
  const f = `${segment(ctx, 0, cutStart, "v0", "a0")};${segment(ctx, cutEnd, null, "v1", "a1")};[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`;
  ffmpeg(["-i", src, "-filter_complex", f, "-map", "[v]", "-map", "[a]", ...ENCODE, out], ctx.cwd);
}

/** 先頭 sec 秒を落とす（オープニング欠落） */
export function makeHeadCut(ctx: VariantContext, out: string, sec: number): void {
  ffmpeg(["-ss", sec.toFixed(3), "-i", ctx.sampleAbs, ...ENCODE, out], ctx.cwd);
}

/** 末尾 sec 秒を落とす（エンディング欠落） */
export function makeTailCut(ctx: VariantContext, out: string, sec: number): void {
  ffmpeg(["-i", ctx.sampleAbs, "-t", Math.max(1, ctx.sampleDurationSec - sec).toFixed(3), ...ENCODE, out], ctx.cwd);
}

/** [dupStart, dupEnd) を末尾にもう一度つなぐ */
export function makeDuplicate(ctx: VariantContext, out: string, dupStart: number, dupEnd: number): void {
  const f = `${segment(ctx, 0, null, "v0", "a0")};${segment(ctx, dupStart, dupEnd, "v1", "a1")};[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`;
  ffmpeg(["-i", ctx.sampleAbs, "-filter_complex", f, "-map", "[v]", "-map", "[a]", ...ENCODE, out], ctx.cwd);
}

/** 隣り合う区間 [aStart,aEnd) と [aEnd,bEnd) の順番を入れ替える */
export function makeSwap(ctx: VariantContext, out: string, aStart: number, aEnd: number, bEnd: number): void {
  const f =
    `${segment(ctx, 0, aStart, "v0", "a0")};${segment(ctx, aEnd, bEnd, "v1", "a1")};` +
    `${segment(ctx, aStart, aEnd, "v2", "a2")};${segment(ctx, bEnd, null, "v3", "a3")};` +
    `[v0][a0][v1][a1][v2][a2][v3][a3]concat=n=4:v=1:a=1[v][a]`;
  ffmpeg(["-i", ctx.sampleAbs, "-filter_complex", f, "-map", "[v]", "-map", "[a]", ...ENCODE, out], ctx.cwd);
}

/** at 秒の位置に黒画面＋無音を sec 秒はさむ */
export function makeGapInsert(ctx: VariantContext, out: string, at: number, sec: number): void {
  const f =
    `${segment(ctx, 0, at, "v0", "a0")};${segment(ctx, at, null, "v2", "a2")};` +
    `[1:v]${vNorm(ctx)}[v1];[2:a]${A_NORM}[a1];` +
    `[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]`;
  ffmpeg(
    [
      "-i", ctx.sampleAbs,
      "-f", "lavfi", "-i", `color=black:s=${ctx.width}x${ctx.height}:r=24:d=${sec}`,
      "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${sec}`,
      "-filter_complex", f, "-map", "[v]", "-map", "[a]", ...ENCODE, out,
    ],
    ctx.cwd,
  );
}

/** [start, end) の間だけ字幕帯を黒く塗りつぶす */
export function makeTelopMissing(ctx: VariantContext, out: string, start: number, end: number): void {
  const vf = `drawbox=x=0:y=ih*${1 - SUBTITLE_BAND_RATIO}:w=iw:h=ih*${SUBTITLE_BAND_RATIO}:color=black:t=fill:enable='between(t,${start},${end})'`;
  ffmpeg(["-i", ctx.sampleAbs, "-vf", vf, ...ENCODE, out], ctx.cwd);
}

/** [start, end) の間だけ字幕帯を塗りつぶして別の文を描く */
export function makeTelopWrong(ctx: VariantContext, out: string, start: number, end: number, text: string): void {
  const enable = `enable='between(t,${start},${end})'`;
  const vf =
    `drawbox=x=0:y=ih*${1 - SUBTITLE_BAND_RATIO}:w=iw:h=ih*${SUBTITLE_BAND_RATIO}:color=black:t=fill:${enable},` +
    `drawtext=fontfile='${FONT_FILE}':text='${text}':fontsize=h/22:fontcolor=white:x=(w-text_w)/2:y=h*0.9-text_h:${enable}`;
  ffmpeg(["-i", ctx.sampleAbs, "-vf", vf, ...ENCODE, out], ctx.cwd);
}

/** [start, end) の映像だけを、srcStart からの同じ長さの映像に差し替える（音声はそのまま） */
export function makeSceneSwap(ctx: VariantContext, out: string, start: number, end: number, srcStart: number): void {
  const len = end - start;
  const f =
    `[0:v]trim=0:${start},setpts=PTS-STARTPTS,${vNorm(ctx)}[v0];` +
    `[0:v]trim=${srcStart}:${srcStart + len},setpts=PTS-STARTPTS,${vNorm(ctx)}[v1];` +
    `[0:v]trim=${end},setpts=PTS-STARTPTS,${vNorm(ctx)}[v2];` +
    `[v0][v1][v2]concat=n=3:v=1:a=0[v]`;
  ffmpeg(["-i", ctx.sampleAbs, "-filter_complex", f, "-map", "[v]", "-map", "0:a", ...ENCODE, out], ctx.cwd);
}

/** 動画全体で字幕帯を上に shiftRatio（画面高さの割合）だけ移す */
export function makeTelopMove(ctx: VariantContext, out: string, shiftRatio: number, src = ctx.sampleAbs): void {
  const band = SUBTITLE_BAND_RATIO;
  const f =
    `[0:v]split=2[base][src];` +
    `[src]crop=iw:ih*${band}:0:ih*${1 - band}[strip];` +
    `[base]drawbox=x=0:y=ih*${1 - band}:w=iw:h=ih*${band}:color=black:t=fill[blank];` +
    `[blank][strip]overlay=0:H*${1 - band - shiftRatio}[v]`;
  ffmpeg(["-i", src, "-filter_complex", f, "-map", "[v]", "-map", "0:a", ...ENCODE, out], ctx.cwd);
}

// ---------------------------------------------------------------------------
// 変種の一覧
// ---------------------------------------------------------------------------

/** S06_03_ミナ先生.wav → S06 */
export function sceneOf(voiceFile: string): string {
  return /^(S\d{2})_/i.exec(voiceFile)?.[1]?.toUpperCase() ?? voiceFile;
}

interface PlacedVoice {
  name: string;
  start: number;
  end: number;
}

function placedVoices(ctx: VariantContext): PlacedVoice[] {
  return ctx.voices
    .filter((v) => v.inSample)
    .map((v) => ({ name: v.name, start: v.inSample!.startSec, end: v.inSample!.startSec + v.durationSec }))
    .sort((a, b) => a.start - b.start);
}

/**
 * 見本そのものの検品結果（voices）から、この見本に対する変種の一覧を作る。
 * セリフが 3 本以上見つかっていないと、セリフを使う変種は作れない（空になる）。
 */
export function buildVariantSpecs(ctx: VariantContext): VariantSpec[] {
  const K = CHECK_KEYS;
  const specs: VariantSpec[] = [
    { id: "reencode", title: "見本を低画質で再エンコード", expectedFails: [], allowedExtra: [], build: (o) => makeReencode(ctx, o, 30) },
    { id: "scaled_480p", title: "解像度を 854x480 に変更", expectedFails: [K.resolution], allowedExtra: [], build: (o) => makeScaled(ctx, o, 854, 480) },
    { id: "quiet", title: `音量を ${VOLUME_DROP_DB}dB 下げる`, expectedFails: [K.volume], allowedExtra: [], build: (o) => makeQuiet(ctx, o, VOLUME_DROP_DB) },
    { id: "telop_moved", title: `字幕を画面の${TELOP_MOVE_RATIO * 100}%分上に移す`, expectedFails: [K.telopStyle], allowedExtra: [], build: (o) => makeTelopMove(ctx, o, TELOP_MOVE_RATIO) },
  ];

  const placed = placedVoices(ctx);
  if (placed.length < 3) return specs;

  // オープニング／エンディングの欠落は、セリフを巻き込まずに落とせる余白があるときだけ作る
  // （見本によっては最後のセリフが末尾まで続き、エンディングの区間が無い）
  const first = placed[0];
  const last = placed[placed.length - 1];
  if (first.start >= OPENING_SEC) {
    specs.push({ id: "opening_cut", title: "オープニングを落とす", expectedFails: [K.duration, K.frameOpening], allowedExtra: [], build: (o) => makeHeadCut(ctx, o, OPENING_SEC) });
  }
  const tailSec = ctx.sampleDurationSec - (last.end + 0.3);
  if (tailSec >= MIN_TAIL_CUT_SEC) {
    specs.push({ id: "ending_cut", title: "エンディングを落とす", expectedFails: [K.duration, K.frameEnding], allowedExtra: [], build: (o) => makeTailCut(ctx, o, Math.min(tailSec, ENDING_SEC)) });
  }
  const mid = Math.floor(placed.length / 2);
  const target = placed[mid];
  const next = placed[mid + 1];
  // 加工対象の区間: セリフの少し前から、次のセリフの手前まで
  const cutStart = Math.max(0, target.start - 0.1);
  const cutEnd = next.start - 0.2;
  const targetLabel = target.name.replace(/\.wav$/i, "");

  specs.push(
    { id: "voice_cut", title: `${targetLabel} を切り落とす`, expectedFails: [K.duration, K.voicePresent], allowedExtra: [], build: (o) => makeCut(ctx, o, cutStart, cutEnd) },
    { id: "voice_dup", title: `${targetLabel} を末尾に重ねる`, expectedFails: [K.duration, K.voiceDuplicate, K.frameEnding], allowedExtra: [], build: (o) => makeDuplicate(ctx, o, cutStart, cutEnd) },
    { id: "gap_insert", title: `${targetLabel} の前に ${GAP_INSERT_SEC} 秒の無音をはさむ`, expectedFails: [K.duration, K.voiceSpacing], allowedExtra: [], build: (o) => makeGapInsert(ctx, o, cutStart, GAP_INSERT_SEC) },
    { id: "telop_missing", title: `${targetLabel} の字幕を塗りつぶす`, expectedFails: [K.telopPresent], allowedExtra: [], build: (o) => makeTelopMissing(ctx, o, cutStart, cutEnd) },
    { id: "telop_wrong", title: `${targetLabel} の字幕を別の文にする`, expectedFails: [K.telopText], allowedExtra: [], build: (o) => makeTelopWrong(ctx, o, cutStart, cutEnd, "これは別のセリフの字幕です") },
    {
      id: "voice_cut_and_telop_moved",
      title: `${targetLabel} を切り落とし、さらに字幕を上に移す（複合）`,
      expectedFails: [K.duration, K.voicePresent, K.telopStyle],
      allowedExtra: [],
      build: (o) => {
        const tmp = o.replace(/\.mp4$/i, "") + "_tmp_cut.mp4";
        makeCut(ctx, tmp, cutStart, cutEnd);
        makeTelopMove(ctx, o, TELOP_MOVE_RATIO, tmp);
      },
    },
  );

  // 順番入れ替え: 加工対象と次のセリフ（同じ場面が望ましいが、無ければ隣どうし）
  const after = placed[mid + 2];
  const bEnd = after ? after.start - 0.2 : next.end + 0.3;
  if (bEnd > cutEnd + 0.5) {
    specs.push({
      id: "voice_swap",
      title: `${targetLabel} と次のセリフの順番を入れ替える`,
      expectedFails: [K.voiceOrder],
      // 入れ替えで前後の間隔も変わりうる。場面をまたぐと場面の映像も動く
      allowedExtra: [K.voiceSpacing, K.frameScene],
      build: (o) => makeSwap(ctx, o, cutStart, cutEnd, bEnd),
    });
  }

  // 場面差し替え: 加工対象が属する場面の全セリフ区間を、別の時刻の映像にする
  const scene = sceneOf(target.name);
  const sceneVoices = placed.filter((p) => sceneOf(p.name) === scene);
  const spanStart = Math.max(0, Math.min(...sceneVoices.map((p) => p.start)) - 0.5);
  const spanEnd = Math.max(...sceneVoices.map((p) => p.end)) + 0.5;
  const len = spanEnd - spanStart;
  const srcStart = spanStart - len - 30 >= 0 ? spanStart - len - 30 : spanEnd + 30;
  if (srcStart + len < ctx.sampleDurationSec) {
    specs.push({
      id: "scene_swap",
      title: `場面 ${scene} の映像を別の場面の映像に差し替える`,
      // 差し替えた映像には元の字幕が焼き込まれているので、字幕の文も本当に違う
      expectedFails: [K.frameScene, K.telopText],
      allowedExtra: [],
      build: (o) => makeSceneSwap(ctx, o, spanStart, spanEnd, srcStart),
    });
  }

  return specs;
}
