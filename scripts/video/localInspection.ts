/**
 * パッケージフォルダ（完成見本.mp4 と 支給素材一式.zip があるフォルダ）と提出動画から、
 * 本番の検品ワーカーと同じ項目（実測比較・構成照合・字幕照合・映像照合）を DB 無しで実行する。
 * スモークテスト（smoke-structure-check）と精度測定（measure-inspection-accuracy）の共通部分。
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { probeStreams, probeVolumeDb } from "./exec";
import { runStructureCheck, type StructureCheckResult } from "./structureCheck";
import { runTelopCheck, type TelopCheckResult } from "./telopCheck";
import { runFrameCheck, type FrameCheckResult } from "./frameCheck";
import { readZipEntries } from "./unzip";
import { compareProbeToSample } from "../../src/lib/video/inspection/compareSample";
import type { CheckItem, ProbeResult } from "../../src/lib/video/inspection/types";

export interface LocalPackage {
  dir: string;
  /** 報告用の名前（job_xxx/package なら job_xxx） */
  name: string;
  sampleFile: string;
  assetsZip: Buffer;
  instructionText: string | null;
  sampleProbe: ProbeResult;
}

export interface LocalInspection {
  checks: CheckItem[];
  probe: ProbeResult;
  structure: StructureCheckResult;
  telop: TelopCheckResult;
  frames: FrameCheckResult;
  elapsedSec: number;
}

export function probeAll(file: string, cwd: string): ProbeResult {
  const s = probeStreams(file, cwd);
  const v = probeVolumeDb(file, cwd);
  return { durationSec: s.durationSec, width: s.width, height: s.height, hasVideo: s.hasVideo, hasAudio: s.hasAudio, meanVolumeDb: v.meanVolumeDb };
}

export function packageName(pkgDir: string): string {
  const abs = resolve(pkgDir);
  const base = basename(abs);
  return base === "package" ? basename(dirname(abs)) : base;
}

/** 作業指示一覧: フォルダ直下の CSV → ZIP 内の CSV → app_task.json の timelineMd の順に探す */
function instructionTextOf(pkgDir: string, assetsZip: Buffer): string | null {
  const local = join(pkgDir, "作業指示一覧.csv");
  if (existsSync(local)) return readFileSync(local, "utf8");
  const csv = readZipEntries(assetsZip, (n) => /(^|\/)作業指示一覧\.csv$/.test(n))[0];
  if (csv) return csv.data.toString("utf8");
  const appTask = join(pkgDir, "app_task.json");
  if (existsSync(appTask)) {
    const md = (JSON.parse(readFileSync(appTask, "utf8")) as { timelineMd?: string }).timelineMd;
    if (md) return md;
  }
  return null;
}

export function loadLocalPackage(pkgDir: string, workdir: string): LocalPackage {
  const dir = resolve(pkgDir);
  const sampleFile = join(dir, "完成見本.mp4");
  const zipFile = join(dir, "支給素材一式.zip");
  for (const f of [sampleFile, zipFile]) {
    if (!existsSync(f)) throw new Error(`見つかりません: ${f}`);
  }
  mkdirSync(workdir, { recursive: true });
  const assetsZip = readFileSync(zipFile);
  return {
    dir,
    name: packageName(dir),
    sampleFile,
    assetsZip,
    instructionText: instructionTextOf(dir, assetsZip),
    sampleProbe: probeAll(sampleFile, workdir),
  };
}

export async function inspectLocally(pkg: LocalPackage, submissionFile: string, workdir: string): Promise<LocalInspection> {
  const started = Date.now();
  const submissionAbs = resolve(submissionFile);
  const structure = runStructureCheck({ workdir, sampleFile: pkg.sampleFile, submissionFile: submissionAbs, assetsZip: pkg.assetsZip });
  const voiceDurations = Object.fromEntries(structure.details.map((d) => [d.name, d.durationSec]));
  const telop = await runTelopCheck({
    workdir,
    submissionFile: submissionAbs,
    instructionText: pkg.instructionText,
    voices: structure.details,
    voiceDurations,
  });
  const probe = probeAll(submissionAbs, workdir);
  const probeChecks = compareProbeToSample(probe, pkg.sampleProbe);
  const frames = await runFrameCheck({
    workdir,
    sampleFile: pkg.sampleFile,
    submissionFile: submissionAbs,
    sampleDurationSec: pkg.sampleProbe.durationSec,
    submissionDurationSec: probe.durationSec,
    voices: structure.details,
  });
  return {
    checks: [...probeChecks, ...structure.checks, ...telop.checks, ...frames.checks],
    probe,
    structure,
    telop,
    frames,
    elapsedSec: (Date.now() - started) / 1000,
  };
}
