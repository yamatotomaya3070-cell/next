/**
 * 構成照合＋字幕照合＋映像照合のスモークテスト（DB 不要・ffmpeg 必要・字幕照合は GEMINI_API_KEY 必要）。
 *
 * 就労者パッケージ（完成見本.mp4 と 支給素材一式.zip があるフォルダ）を使い、
 *   1. 見本そのものを提出した場合 → 全項目 pass になるか
 *   2〜. わざとミスを入れた提出（scripts/video/variants.ts の各変種）→ 期待した項目が fail になるか
 * を確かめる。提出動画は ffmpeg で見本から作る（再エンコードも通る）。
 * 全変種をまとめて集計したいときは measure-inspection-accuracy.ts を使う。
 *
 * 使い方:
 *   npx tsx scripts/video/smoke-structure-check.ts <パッケージフォルダ> [提出動画.mp4]
 *   提出動画を渡すと、その1本だけ照合して結果を表示する。
 *   --skip-variants を付けると 1 だけ（加工版を作らない）。
 *   --cases voice_cut,telop_moved のように付けると、1 と指定した変種だけを実行する。
 */
import { copyFileSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { loadEnvLocal } from "./env";
import { inspectLocally, loadLocalPackage, packageName, type LocalInspection } from "./localInspection";
import { buildVariantSpecs } from "./variants";
import { computeAutoScore } from "../../src/lib/video/inspection/score";
import type { CheckItem } from "../../src/lib/video/inspection/types";

loadEnvLocal();

const STATUS_MARK: Record<string, string> = { pass: "OK ", fail: "NG ", unknown: "?? " };

function report(title: string, checks: CheckItem[]) {
  console.log(`\n=== ${title}（自動採点 ${computeAutoScore(checks)}点）`);
  for (const c of checks) {
    console.log(`  ${STATUS_MARK[c.status]} ${c.label}: ${c.actual}  ← 見本: ${c.expected}`);
  }
}

function summarize(result: LocalInspection) {
  const { structure, telop, frames } = result;
  const scores = structure.details.map((d) => d.inSample?.score ?? 0);
  const covs = structure.details.map((d) => d.inSample?.coverage ?? 0);
  const found = structure.details.filter((d) => d.inSample).length;
  const min = (xs: number[]) => (xs.length ? Math.min(...xs) : 0);
  console.log(
    `  照合統計: 見本で見つかったセリフ ${found}/${structure.details.length}本, 最低スコア ${min(scores).toFixed(2)}, 最低カバー率 ${min(covs).toFixed(2)}`,
  );

  if (telop.skippedReason) {
    console.log(`  字幕照合: ${telop.skippedReason}`);
  } else {
    const empty = telop.observations.filter((o) => o.ocrTexts.every((t) => !t.trim())).length;
    console.log(`  字幕照合: ${telop.observations.length}本を OCR（文字なし ${empty}本）`);
    for (const o of telop.observations.slice(0, 3)) {
      console.log(`    例: ${o.voiceFile} OCR「${o.ocrTexts[0]}」 指示「${o.expected}」`);
    }
  }

  if (frames.skippedReason) {
    console.log(`  映像照合: ${frames.skippedReason}`);
  } else {
    const byKind = (kind: string) => frames.frames.filter((f) => f.kind === kind).map((f) => f.similarity);
    const minS = (xs: number[]) => (xs.length ? Math.min(...xs).toFixed(2) : "-");
    console.log(
      `  映像照合: アンカー ${frames.frames.length}か所（最低類似度 オープニング ${minS(byKind("opening"))} / エンディング ${minS(byKind("ending"))} / 場面 ${minS(byKind("scene"))}）`,
    );
    const readable = frames.styles.filter((s) => s.sample && s.submission);
    console.log(`  字幕位置: ${frames.styles.length}本中 ${readable.length}本で読み取り`);
  }
}

async function main() {
  const skipVariants = process.argv.includes("--skip-variants");
  const casesArg = process.argv.includes("--cases") ? process.argv[process.argv.indexOf("--cases") + 1] : undefined;
  const wantedCases = casesArg ? new Set(casesArg.split(",")) : null;
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--") && a !== casesArg);
  const pkgDir = args[0];
  const submissionArg = args[1];
  if (!pkgDir) {
    console.error("使い方: npx tsx scripts/video/smoke-structure-check.ts <パッケージフォルダ> [提出動画.mp4] [--skip-variants] [--cases a,b]");
    process.exit(1);
  }
  const workdir = resolve("scripts", "output", "smoke-structure", packageName(pkgDir));
  const pkg = loadLocalPackage(pkgDir, workdir);

  const check = async (title: string, submissionAbs: string) => {
    const result = await inspectLocally(pkg, submissionAbs, workdir);
    report(`${title}（${result.elapsedSec.toFixed(1)}秒）`, result.checks);
    summarize(result);
    return result;
  };

  if (submissionArg) {
    if (!existsSync(submissionArg)) {
      console.error(`見つかりません: ${submissionArg}`);
      process.exit(1);
    }
    await check(basename(submissionArg), resolve(submissionArg));
    return;
  }

  // 1) 見本そのもの
  const identical = join(workdir, "01_identical.mp4");
  copyFileSync(pkg.sampleFile, identical);
  const base = await check("1. 見本そのものを提出", identical);
  if (skipVariants) return;

  const specs = buildVariantSpecs({
    sampleAbs: pkg.sampleFile,
    cwd: workdir,
    sampleDurationSec: pkg.sampleProbe.durationSec,
    width: pkg.sampleProbe.width ?? 1280,
    height: pkg.sampleProbe.height ?? 720,
    voices: base.structure.details,
  }).filter((s) => !wantedCases || wantedCases.has(s.id));
  if (specs.length === 0) {
    console.log("\n実行する変種がありません（セリフが見本の中で3本以上見つからないか、--cases の指定が合いません）。");
    return;
  }

  let no = 2;
  for (const spec of specs) {
    const file = join(workdir, `${String(no).padStart(2, "0")}_${spec.id}.mp4`);
    spec.build(file);
    const result = await check(`${no}. ${spec.title}`, file);
    for (const key of spec.expectedFails) {
      const item = result.checks.find((c) => c.key === key);
      console.log(`  期待: ${key}=NG → 実際: ${item?.status ?? "項目なし"}`);
    }
    no++;
  }
}

main().catch((err) => {
  console.error("スモークテストに失敗しました:", err);
  process.exit(1);
});
