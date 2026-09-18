// 案件を登録する前の関門：支給素材だけで、手順どおりに完成見本と同じものが作れるかを確かめる。
// 1つでも合わなければ例外を投げ、案件は登録されない（registerSceneTask の最初で呼ぶ）。
//
// 確かめること
//   1. 「絆_素材を並べる」で置けない素材が無い（場面の映像・BGM・オープニング・エンディング）
//   2. 並べた全体の長さが、完成見本と合っている（±3フレーム以内）
//   3. 作業指示一覧の行が、セリフの音声と1対1で合っている（字幕の文をここからコピーするため）
//   4. 声の音量が調整済み（ピークが -2dBFS 以下。書き出しで音割れしないため）
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { simulateArrange, type ClipInfo } from "../../src/lib/scene/arrangeSimulation";

const FPS = 24;
const MAX_DURATION_DIFF_FRAMES = 3;
const MAX_VOICE_PEAK_DB = -2;

function ffprobe(args: string[]): string {
  const r = spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffprobe に失敗: ${r.stderr}`);
  return r.stdout.trim();
}

const durationSec = (file: string) =>
  Number(ffprobe(["-show_entries", "format=duration", "-of", "csv=p=0", file]));

// Resolve と同じ数え方（arrangeSimulation.ts の説明を参照）
const audioFrames = (file: string) => Math.floor(durationSec(file) * FPS);
const videoFrames = (file: string) =>
  Number(ffprobe(["-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", file]));

function peakDb(file: string): number {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(r.stderr ?? "");
  if (!m) throw new Error(`音量を測れません: ${file}`);
  return Number(m[1]);
}

const list = (dir: string, re: RegExp) =>
  existsSync(dir) ? readdirSync(dir).filter((n) => re.test(n)).sort() : [];

export interface VerifyReport {
  totalFrames: number;
  sampleFrames: number;
  voices: number;
  videos: number;
}

export function verifyPackage(pkgDir: string): VerifyReport {
  const problems: string[] = [];
  const dir = `${pkgDir}/素材`;
  const clip = (sub: string, name: string, count: (f: string) => number): ClipInfo | null => {
    const f = `${dir}/${sub}/${name}`;
    return existsSync(f) ? { name, frames: count(f) } : null;
  };

  const voiceNames = list(`${dir}/音声`, /^S\d{2}_\d{2}_.+\.wav$/);
  const voices = voiceNames.map((n) => ({ name: n, frames: audioFrames(`${dir}/音声/${n}`) }));
  const videos = list(`${dir}/映像`, /^S\d{2}_.+\.mp4$/).map((n) => ({ name: n, frames: videoFrames(`${dir}/映像/${n}`) }));
  const opening = clip("映像", "オープニング.mp4", videoFrames);
  const ending = clip("映像", "エンディング.mp4", videoFrames);
  const bgm = clip("BGM", "BGM.wav", audioFrames);

  if (voices.length === 0) problems.push("セリフの音声がありません");
  if (!opening) problems.push("オープニング.mp4 がありません");
  if (!ending) problems.push("エンディング.mp4 がありません");

  // 1) 並べられるか
  const arranged = simulateArrange({ voices, videos, opening, ending, bgm });
  problems.push(...arranged.problems);

  // 2) 完成見本と長さが合うか
  const sampleFile = `${pkgDir}/完成見本.mp4`;
  const sampleFrames = existsSync(sampleFile) ? Math.round(durationSec(sampleFile) * FPS) : 0;
  if (!sampleFrames) problems.push("完成見本.mp4 がありません");
  else if (Math.abs(sampleFrames - arranged.totalFrames) > MAX_DURATION_DIFF_FRAMES) {
    problems.push(`並べた長さ ${arranged.totalFrames}f と完成見本 ${sampleFrames}f が合いません（${MAX_DURATION_DIFF_FRAMES}f 以内のはず）`);
  }

  // 3) 作業指示一覧とセリフが1対1か
  const appTask = `${pkgDir}/app_task.json`;
  if (!existsSync(appTask)) problems.push("app_task.json がありません");
  else {
    const md: string = JSON.parse(readFileSync(appTask, "utf8")).timelineMd ?? "";
    const listed = [...md.matchAll(/\|\s*(S\d{2}_\d{2}_[^|]+?\.wav)\s*\|/g)].map((m) => m[1]);
    const missing = voiceNames.filter((n) => !listed.includes(n));
    const extra = listed.filter((n) => !voiceNames.includes(n));
    if (missing.length) problems.push(`作業指示一覧に無いセリフ: ${missing.join(", ")}`);
    if (extra.length) problems.push(`作業指示一覧にあるが音声が無い: ${extra.join(", ")}`);
  }

  // 4) 声の音量
  for (const n of voiceNames) {
    const peak = peakDb(`${dir}/音声/${n}`);
    if (peak > MAX_VOICE_PEAK_DB) problems.push(`${n} の音が大きすぎます（ピーク ${peak}dB）`);
  }

  if (problems.length > 0) {
    throw new Error(`支給素材から完成見本を作れません。案件は登録しません。\n- ${problems.join("\n- ")}`);
  }
  return { totalFrames: arranged.totalFrames, sampleFrames, voices: voices.length, videos: videos.length };
}

// 単体で使うとき: npx tsx scripts/scene/verifyPackage.ts <パッケージフォルダ>
if (process.argv[1]?.endsWith("verifyPackage.ts") && process.argv[2]) {
  const r = verifyPackage(process.argv[2]);
  console.log(`OK: 並べた長さ ${r.totalFrames}f / 完成見本 ${r.sampleFrames}f / セリフ ${r.voices}本 / 場面の映像 ${r.videos}本`);
}
