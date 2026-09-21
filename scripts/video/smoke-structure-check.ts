/**
 * 構成照合＋字幕照合のスモークテスト（DB 不要・ffmpeg 必要・字幕照合は GEMINI_API_KEY 必要）。
 *
 * 就労者パッケージ（完成見本.mp4 と 支給素材一式.zip があるフォルダ）を使い、
 *   1. 見本そのものを提出した場合          → 全項目 pass になるか
 *   2. セリフを1本切り落とした提出            → 「セリフの入れ忘れ」が fail になるか
 *   3. セリフを1本重ねた提出                  → 「セリフの重複」が fail になるか
 *   4. あるセリフの字幕を黒く塗りつぶした提出 → 「字幕の入れ忘れ」が fail になるか
 *   5. あるセリフの字幕を別の文にした提出     → 「字幕の文」が fail になるか
 * を確かめる。提出動画は ffmpeg で見本から作る（再エンコードも通る）。
 *
 * 使い方:
 *   npx tsx scripts/video/smoke-structure-check.ts <パッケージフォルダ> [提出動画.mp4]
 *   提出動画を渡すと、その1本だけ照合して結果を表示する。
 *   --skip-variants を付けると 1 だけ（加工版を作らない）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { loadEnvLocal } from "./env";
import { run, probeStreams, probeVolumeDb } from "./exec";
import { runStructureCheck, type StructureCheckResult } from "./structureCheck";
import { runTelopCheck, type TelopCheckResult } from "./telopCheck";
import { readZipEntries } from "./unzip";
import { compareProbeToSample } from "../../src/lib/video/inspection/compareSample";
import { computeAutoScore } from "../../src/lib/video/inspection/score";
import type { CheckItem, ProbeResult } from "../../src/lib/video/inspection/types";

loadEnvLocal();

const STATUS_MARK: Record<string, string> = { pass: "OK ", fail: "NG ", unknown: "?? " };
const ENCODE = ["-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac"];
/** 字幕を塗りつぶす帯（画面の下から何割か） */
const SUBTITLE_BAND = 0.2;
const FONT_FILE = "C\\:/Windows/Fonts/meiryo.ttc";

function probeAll(file: string, cwd: string): ProbeResult {
  const s = probeStreams(file, cwd);
  const v = probeVolumeDb(file, cwd);
  return { durationSec: s.durationSec, width: s.width, height: s.height, hasVideo: s.hasVideo, hasAudio: s.hasAudio, meanVolumeDb: v.meanVolumeDb };
}

function report(title: string, checks: CheckItem[]) {
  console.log(`\n=== ${title}（自動採点 ${computeAutoScore(checks)}点）`);
  for (const c of checks) {
    console.log(`  ${STATUS_MARK[c.status]} ${c.label}: ${c.actual}  ← 見本: ${c.expected}`);
  }
}

function summarizeMatches(result: StructureCheckResult) {
  const scores = result.details.map((d) => d.inSample?.score ?? 0);
  const covs = result.details.map((d) => d.inSample?.coverage ?? 0);
  const found = result.details.filter((d) => d.inSample).length;
  const min = (xs: number[]) => (xs.length ? Math.min(...xs) : 0);
  console.log(
    `  照合統計: 見本で見つかったセリフ ${found}/${result.details.length}本, 最低スコア ${min(scores).toFixed(2)}, 最低カバー率 ${min(covs).toFixed(2)}`,
  );
}

function summarizeTelops(result: TelopCheckResult) {
  if (result.skippedReason) {
    console.log(`  字幕照合: ${result.skippedReason}`);
    return;
  }
  const empty = result.observations.filter((o) => o.ocrTexts.every((t) => !t.trim())).length;
  console.log(`  字幕照合: ${result.observations.length}本を OCR（文字なし ${empty}本）`);
  for (const o of result.observations.slice(0, 3)) {
    console.log(`    例: ${o.voiceFile} OCR「${o.ocrTexts[0]}」 指示「${o.expected}」`);
  }
}

function instructionTextOf(pkgDir: string, assetsZip: Buffer): string | null {
  const csv = readZipEntries(assetsZip, (n) => /(^|\/)作業指示一覧\.csv$/.test(n))[0];
  if (csv) return csv.data.toString("utf8");
  const appTask = join(pkgDir, "app_task.json");
  if (existsSync(appTask)) {
    const md = (JSON.parse(readFileSync(appTask, "utf8")) as { timelineMd?: string }).timelineMd;
    if (md) return md;
  }
  return null;
}

/** [cutStart, cutEnd) の区間を切り落とした動画を作る（映像も音声も再エンコード） */
function makeCutVariant(sampleAbs: string, out: string, cutStart: number, cutEnd: number, cwd: string) {
  const f =
    `[0:v]trim=0:${cutStart},setpts=PTS-STARTPTS[v0];[0:v]trim=${cutEnd},setpts=PTS-STARTPTS[v1];` +
    `[0:a]atrim=0:${cutStart},asetpts=PTS-STARTPTS[a0];[0:a]atrim=${cutEnd},asetpts=PTS-STARTPTS[a1];` +
    `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`;
  run("ffmpeg", ["-y", "-i", sampleAbs, "-filter_complex", f, "-map", "[v]", "-map", "[a]", ...ENCODE, out], cwd);
}

/** [dupStart, dupEnd) の区間を末尾にもう一度つなげた動画を作る */
function makeDuplicateVariant(sampleAbs: string, out: string, dupStart: number, dupEnd: number, cwd: string) {
  const f =
    `[0:v]trim=${dupStart}:${dupEnd},setpts=PTS-STARTPTS[v1];[0:a]atrim=${dupStart}:${dupEnd},asetpts=PTS-STARTPTS[a1];` +
    `[0:v][0:a][v1][a1]concat=n=2:v=1:a=1[v][a]`;
  run("ffmpeg", ["-y", "-i", sampleAbs, "-filter_complex", f, "-map", "[v]", "-map", "[a]", ...ENCODE, out], cwd);
}

/** [start, end) の間だけ、画面下部の字幕帯を黒く塗りつぶす（字幕の入れ忘れを模す） */
function makeTelopMissingVariant(sampleAbs: string, out: string, start: number, end: number, cwd: string) {
  const vf = `drawbox=x=0:y=ih*${1 - SUBTITLE_BAND}:w=iw:h=ih*${SUBTITLE_BAND}:color=black:t=fill:enable='between(t,${start},${end})'`;
  run("ffmpeg", ["-y", "-i", sampleAbs, "-vf", vf, ...ENCODE, out], cwd);
}

/** [start, end) の間だけ、字幕帯を塗りつぶして別の文を描く（字幕の文言違いを模す） */
function makeTelopWrongVariant(sampleAbs: string, out: string, start: number, end: number, text: string, cwd: string) {
  const enable = `enable='between(t,${start},${end})'`;
  const vf =
    `drawbox=x=0:y=ih*${1 - SUBTITLE_BAND}:w=iw:h=ih*${SUBTITLE_BAND}:color=black:t=fill:${enable},` +
    `drawtext=fontfile='${FONT_FILE}':text='${text}':fontsize=h/22:fontcolor=white:x=(w-text_w)/2:y=h*0.9-text_h:${enable}`;
  run("ffmpeg", ["-y", "-i", sampleAbs, "-vf", vf, ...ENCODE, out], cwd);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const skipVariants = process.argv.includes("--skip-variants");
  const pkgDir = args[0];
  const submissionArg = args[1];
  if (!pkgDir) {
    console.error("使い方: npx tsx scripts/video/smoke-structure-check.ts <パッケージフォルダ> [提出動画.mp4] [--skip-variants]");
    process.exit(1);
  }
  const sampleAbs = resolve(pkgDir, "完成見本.mp4");
  const zipAbs = resolve(pkgDir, "支給素材一式.zip");
  for (const f of [sampleAbs, zipAbs]) {
    if (!existsSync(f)) {
      console.error(`見つかりません: ${f}`);
      process.exit(1);
    }
  }
  const workdir = resolve("scripts", "output", "smoke-structure", basename(resolve(pkgDir)));
  mkdirSync(workdir, { recursive: true });
  const assetsZip = readFileSync(zipAbs);
  const instructionText = instructionTextOf(pkgDir, assetsZip);
  const sampleProbe = probeAll(sampleAbs, workdir);

  const check = async (title: string, submissionAbs: string) => {
    const started = Date.now();
    const structure = runStructureCheck({ workdir, sampleFile: sampleAbs, submissionFile: submissionAbs, assetsZip });
    const telop = await runTelopCheck({
      workdir,
      submissionFile: submissionAbs,
      instructionText,
      voices: structure.details,
      voiceDurations: Object.fromEntries(structure.details.map((d) => [d.name, d.durationSec])),
    });
    const probeChecks = compareProbeToSample(probeAll(submissionAbs, workdir), sampleProbe);
    report(`${title}（${((Date.now() - started) / 1000).toFixed(1)}秒）`, [...probeChecks, ...structure.checks, ...telop.checks]);
    summarizeMatches(structure);
    summarizeTelops(telop);
    return { structure, telop };
  };
  const expectFail = (label: string, items: CheckItem[], key: string) => {
    const item = items.find((c) => c.key === key);
    console.log(`  期待: ${label}=NG → 実際: ${item?.status ?? "項目なし"}`);
  };

  if (submissionArg) {
    await check(basename(submissionArg), resolve(submissionArg));
    return;
  }

  // 1) 見本そのもの
  const identical = join(workdir, "01_identical.mp4");
  copyFileSync(sampleAbs, identical);
  const base = await check("1. 見本そのものを提出", identical);
  if (skipVariants) return;

  // 見本の中で見つかったセリフから、真ん中あたりの1本を選んで加工対象にする
  const placed = base.structure.placements
    .filter((p) => p.sampleStartSec !== null)
    .sort((a, b) => a.sampleStartSec! - b.sampleStartSec!);
  if (placed.length < 3) {
    console.log("\nセリフが見本の中で3本以上見つからなかったため、加工テストは省略します。");
    return;
  }
  const mid = Math.floor(placed.length / 2);
  const target = placed[mid];
  const next = placed[mid + 1];
  const cutStart = Math.max(0, target.sampleStartSec! - 0.1);
  const cutEnd = next.sampleStartSec! - 0.2; // 次のセリフの手前まで
  console.log(`\n加工対象: ${target.name}（見本の ${cutStart.toFixed(1)}〜${cutEnd.toFixed(1)}秒）`);

  if (!process.argv.includes("--only-telop")) {
    // 2) そのセリフを切り落とす
    const cut = join(workdir, "02_missing.mp4");
    makeCutVariant(sampleAbs, cut, cutStart, cutEnd, workdir);
    const missing = await check(`2. ${target.name} を切り落とした提出`, cut);
    expectFail("セリフの入れ忘れ", missing.structure.checks, "voice_present");

    // 3) そのセリフを末尾にもう一度つなぐ
    const dup = join(workdir, "03_duplicate.mp4");
    makeDuplicateVariant(sampleAbs, dup, cutStart, cutEnd, workdir);
    const duplicated = await check(`3. ${target.name} を末尾に重ねた提出`, dup);
    expectFail("セリフの重複", duplicated.structure.checks, "voice_duplicate");
  }

  if (!instructionText) {
    console.log("\n作業指示一覧が無いため、字幕の加工テストは省略します。");
    return;
  }

  // 4) そのセリフの字幕を塗りつぶす
  const telopMissing = join(workdir, "04_telop_missing.mp4");
  makeTelopMissingVariant(sampleAbs, telopMissing, cutStart, cutEnd, workdir);
  const tm = await check(`4. ${target.name} の字幕を塗りつぶした提出`, telopMissing);
  expectFail("字幕の入れ忘れ", tm.telop.checks, "telop_present");

  // 5) そのセリフの字幕を別の文にする
  const telopWrong = join(workdir, "05_telop_wrong.mp4");
  makeTelopWrongVariant(sampleAbs, telopWrong, cutStart, cutEnd, "これは別のセリフの字幕です", workdir);
  const tw = await check(`5. ${target.name} の字幕を別の文にした提出`, telopWrong);
  expectFail("字幕の文", tw.telop.checks, "telop_text");
}

main().catch((err) => {
  console.error("スモークテストに失敗しました:", err);
  process.exit(1);
});
