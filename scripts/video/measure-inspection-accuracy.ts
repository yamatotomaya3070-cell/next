/**
 * 提出後AI検品の精度測定（DB 不要・ffmpeg 必要・字幕照合は GEMINI_API_KEY 必要）。
 *
 * パッケージフォルダ（完成見本.mp4 と 支給素材一式.zip があるフォルダ）から
 * 「わざとミスを入れた提出動画」を十数種類作り、本番と同じ検品にかけて、
 *   - 項目別: 検出／誤検知／見逃し／職員確認行き
 *   - 提出単位: 自動差し戻しの判定が正しいか
 * を集計し、Markdown の報告書にする。
 *
 * 1本の検品に約5分かかるので、変種ごとの結果を JSON に保存し、再実行時は済んだ分を飛ばす
 * （途中で止められても続きから再開できる）。
 *
 * 使い方:
 *   npx tsx scripts/video/measure-inspection-accuracy.ts <パッケージフォルダ> [<パッケージフォルダ>...]
 *     [--variants voice_cut,telop_moved]  変種を絞る（identical は常に実行）
 *     [--force]                           保存済みの結果を捨てて測り直す
 *     [--report-only]                     検品はせず、保存済みの結果から報告書だけ作る
 *   出力: scripts/output/accuracy/<パッケージ名>/<変種>.json と scripts/output/accuracy/report.md
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvLocal } from "./env";
import { inspectLocally, loadLocalPackage, packageName, type LocalPackage } from "./localInspection";
import { buildVariantSpecs, type VariantContext, type VariantSpec } from "./variants";
import { renderAccuracyMarkdown, summarizeAccuracy, type VariantOutcome } from "../../src/lib/video/inspection/accuracy";
import type { VoiceMatchDetail } from "./structureCheck";

loadEnvLocal();

const OUT_ROOT = resolve("scripts", "output", "accuracy");
const IDENTICAL_ID = "identical";

interface StoredOutcome extends VariantOutcome {
  /** identical の結果には、変種を作るためのセリフ位置も保存する */
  voices?: VoiceMatchDetail[];
  sampleDurationSec?: number;
  width?: number;
  height?: number;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const valueOf = (flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const variantsArg = valueOf("--variants");
  const flagValues = new Set([variantsArg].filter(Boolean));
  const pkgDirs = argv.filter((a) => !a.startsWith("--") && !flagValues.has(a));
  return {
    pkgDirs,
    variants: variantsArg ? new Set(variantsArg.split(",")) : null,
    force: argv.includes("--force"),
    reportOnly: argv.includes("--report-only"),
  };
}

function outcomePath(pkgName: string, variantId: string): string {
  return join(OUT_ROOT, pkgName, `${variantId}.json`);
}

function loadStored(path: string): StoredOutcome | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as StoredOutcome) : null;
}

async function inspectVariant(
  pkg: LocalPackage,
  workdir: string,
  spec: Pick<VariantSpec, "id" | "title" | "expectedFails" | "allowedExtra">,
  file: string,
  extra: Partial<StoredOutcome> = {},
): Promise<StoredOutcome> {
  console.log(`  ${spec.id}: 検品中（${spec.title}）`);
  const result = await inspectLocally(pkg, file, workdir);
  const outcome: StoredOutcome = {
    packageName: pkg.name,
    variantId: spec.id,
    title: spec.title,
    expectedFails: spec.expectedFails,
    allowedExtra: spec.allowedExtra,
    checks: result.checks.map((c) => ({ key: c.key, label: c.label, status: c.status })),
    elapsedSec: result.elapsedSec,
    ...extra,
  };
  const fails = outcome.checks.filter((c) => c.status === "fail").map((c) => c.key);
  const unknowns = outcome.checks.filter((c) => c.status === "unknown").map((c) => c.key);
  console.log(`    → NG: ${fails.join(", ") || "なし"} / 職員確認: ${unknowns.join(", ") || "なし"}（${Math.round(result.elapsedSec)}秒）`);
  return outcome;
}

async function measurePackage(pkgDir: string, variants: Set<string> | null, force: boolean): Promise<void> {
  const name = packageName(pkgDir);
  const workdir = join(OUT_ROOT, name);
  mkdirSync(workdir, { recursive: true });
  const pkg = loadLocalPackage(pkgDir, workdir);
  console.log(`\n=== ${name}（見本 ${Math.round(pkg.sampleProbe.durationSec)}秒）`);

  // 1) 見本そのもの（変種の位置決めにも使う）
  const identicalPath = outcomePath(name, IDENTICAL_ID);
  let identical = force ? null : loadStored(identicalPath);
  if (!identical || !identical.voices) {
    const file = join(workdir, "identical.mp4");
    copyFileSync(pkg.sampleFile, file);
    const result = await inspectLocally(pkg, file, workdir);
    identical = {
      packageName: name,
      variantId: IDENTICAL_ID,
      title: "見本そのもの",
      expectedFails: [],
      allowedExtra: [],
      checks: result.checks.map((c) => ({ key: c.key, label: c.label, status: c.status })),
      elapsedSec: result.elapsedSec,
      voices: result.structure.details,
      sampleDurationSec: pkg.sampleProbe.durationSec,
      width: pkg.sampleProbe.width ?? 1280,
      height: pkg.sampleProbe.height ?? 720,
    };
    writeFileSync(identicalPath, JSON.stringify(identical, null, 2), "utf8");
    const fails = identical.checks.filter((c) => c.status === "fail").map((c) => c.key);
    console.log(`  identical: NG ${fails.join(", ") || "なし"}（${Math.round(identical.elapsedSec)}秒）`);
  } else {
    console.log(`  identical: 保存済み`);
  }

  // 2) 変種
  const ctx: VariantContext = {
    sampleAbs: pkg.sampleFile,
    cwd: workdir,
    sampleDurationSec: identical.sampleDurationSec ?? pkg.sampleProbe.durationSec,
    width: identical.width ?? 1280,
    height: identical.height ?? 720,
    voices: identical.voices!,
  };
  const specs = buildVariantSpecs(ctx).filter((s) => !variants || variants.has(s.id));
  console.log(`  変種 ${specs.length} 種: ${specs.map((s) => s.id).join(", ")}`);
  for (const spec of specs) {
    const path = outcomePath(name, spec.id);
    if (!force && existsSync(path)) {
      console.log(`  ${spec.id}: 保存済み`);
      continue;
    }
    const file = join(workdir, `${spec.id}.mp4`);
    try {
      if (force || !existsSync(file)) {
        console.log(`  ${spec.id}: 提出動画を作成`);
        spec.build(file);
      }
      const outcome = await inspectVariant(pkg, workdir, spec, file);
      writeFileSync(path, JSON.stringify(outcome, null, 2), "utf8");
    } catch (err) {
      // 1本の失敗（メモリ不足で ffmpeg が起動できない等）で全体を止めない。保存しないので再実行時にやり直される
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ${spec.id}: 失敗（次の変種へ進みます）: ${message.slice(0, 300)}`);
      failedVariants.push(`${name}/${spec.id}`);
    }
  }
}

/** 今回の実行で失敗した変種（最後に一覧する） */
const failedVariants: string[] = [];

function collectOutcomes(): VariantOutcome[] {
  if (!existsSync(OUT_ROOT)) return [];
  const outcomes: VariantOutcome[] = [];
  for (const pkgName of readdirSync(OUT_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const dir = join(OUT_ROOT, pkgName);
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const stored = loadStored(join(dir, f));
      if (stored) outcomes.push(stored);
    }
  }
  // identical を先頭に、あとは変種名順
  return outcomes.sort((a, b) =>
    a.packageName !== b.packageName
      ? a.packageName.localeCompare(b.packageName)
      : (a.variantId === IDENTICAL_ID ? -1 : b.variantId === IDENTICAL_ID ? 1 : a.variantId.localeCompare(b.variantId)),
  );
}

function writeReport(): void {
  const outcomes = collectOutcomes();
  const summary = summarizeAccuracy(outcomes);
  const md = renderAccuracyMarkdown(outcomes, summary, new Date());
  mkdirSync(OUT_ROOT, { recursive: true });
  const reportPath = join(OUT_ROOT, "report.md");
  writeFileSync(reportPath, md, "utf8");
  const s = summary.submissions;
  console.log(`\n報告書: ${reportPath}`);
  console.log(`提出 ${s.total}本: 差し戻すべき ${s.shouldReturn} / 正しく差し戻し ${s.tp} / 誤って差し戻し ${s.fp} / 見逃し ${s.fn}`);
  for (const k of summary.keys) {
    const flagged = k.fp + k.fn + k.unknownExpected + k.unknownUnexpected;
    if (flagged > 0) {
      console.log(`  ${k.label}: 検出${k.tp} 誤検知${k.fp} 見逃し${k.fn} 職員確認(NGのはず)${k.unknownExpected} 職員確認(OKのはず)${k.unknownUnexpected}`);
    }
  }
}

async function main() {
  const { pkgDirs, variants, force, reportOnly } = parseArgs();
  if (!reportOnly) {
    if (pkgDirs.length === 0) {
      console.error("使い方: npx tsx scripts/video/measure-inspection-accuracy.ts <パッケージフォルダ>... [--variants a,b] [--force] [--report-only]");
      process.exit(1);
    }
    for (const dir of pkgDirs) await measurePackage(dir, variants, force);
  }
  writeReport();
  if (failedVariants.length > 0) {
    console.log(`\n失敗した変種（同じコマンドで再実行するとやり直します）: ${failedVariants.join(", ")}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("精度測定に失敗しました:", err);
  process.exit(1);
});
