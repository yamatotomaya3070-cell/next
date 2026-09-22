/**
 * 提出動画の機械検品ワーカー。
 *
 * submission_inspections テーブルをポーリングし、未完了ジョブを1件ずつ処理する。
 * ffmpeg/ffprobe に依存するため、Vercel 等のサーバーレス環境では実行できない。
 * 提出時（submitWork）は submission_inspections に pending 行を作るだけで、
 * 実処理はこのワーカーを ffmpeg のあるマシン（常時起動PC）で動かす。
 *
 * 案件の種類で突き合わせ方が変わる（src/lib/review/inspectionTarget.ts）:
 *   - template: video_jobs.answer_data（正解データ表）と比べる
 *   - sample  : 完成見本(task_materials kind=sample)を実測して比べる。
 *               支給素材ZIP(kind=source_assets)があれば、セリフ音声の構成照合も行う
 *
 * 検品が終わったら src/lib/review/applyInspection.ts で AI レビュー下書きへ反映し、
 * NG があれば利用者へ自動で差し戻す。
 *
 * 使い方:
 *   npx tsx scripts/video/inspect-worker.ts            # 未完了ジョブを全件処理して終了
 *   npx tsx scripts/video/inspect-worker.ts --job <id>  # 指定ジョブのみ処理
 *   npx tsx scripts/video/inspect-worker.ts --watch     # 常駐ポーリング（start-worker.bat から）
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { loadEnvLocal } from "./env";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { probeStreams, probeVolumeDb } from "./exec";
import { runStructureCheck } from "./structureCheck";
import { runTelopCheck } from "./telopCheck";
import { runFrameCheck } from "./frameCheck";
import { readZipEntries } from "./unzip";
import { getTemplateConfig, VIDEO_TEMPLATE_TYPES } from "../../src/lib/video/templates";
import { compareProbeToAnswer } from "../../src/lib/video/inspection/compare";
import { compareProbeToSample } from "../../src/lib/video/inspection/compareSample";
import { computeAutoScore } from "../../src/lib/video/inspection/score";
import { loadInspectionTarget, type InspectionTarget } from "../../src/lib/review/inspectionTarget";
import { applyInspectionResult } from "../../src/lib/review/applyInspection";
import type { CheckItem, CheckResult, ProbeResult } from "../../src/lib/video/inspection/types";
import type { TemplateAnswerData } from "../../src/lib/video/templates/types";

/** video_jobs.answer_data(jsonb) は無検証で保存されているため、比較前に最低限の形を確認する */
function assertValidAnswerData(answerData: TemplateAnswerData): void {
  if (!VIDEO_TEMPLATE_TYPES.includes(answerData.templateType)) {
    throw new Error(`answer_data.templateType が不正です: ${String(answerData.templateType)}`);
  }
  if (typeof answerData.totalDurationSec !== "number" || typeof answerData.toleranceSec !== "number") {
    throw new Error("answer_data.totalDurationSec / toleranceSec が不正です");
  }
  if (
    typeof answerData.volumeTargetDb?.min !== "number" ||
    typeof answerData.volumeTargetDb?.max !== "number"
  ) {
    throw new Error("answer_data.volumeTargetDb が不正です");
  }
}

loadEnvLocal();

const WORKER_ID = `${hostname()}-${process.pid}`;
const STALE_LOCK_MS = 15 * 60 * 1000; // 15分以上ロックが更新されないジョブは奪って再開する
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS) || 15_000;
/** 一時的な失敗（通信・ffmpeg）はこの回数まで自動でやり直す */
const MAX_RETRIES = 3;
/**
 * 拾い直す対象。pending/probing/comparing に加え、retry_count が上限未満の failed も含める。
 * completed は含めない（検品結果の反映まで終わった状態でだけ completed にする）。
 */
const CLAIMABLE_FILTER = `status.in.(pending,probing,comparing),and(status.eq.failed,retry_count.lt.${MAX_RETRIES})`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type InspectionRow = {
  id: string;
  submission_id: string;
  status: string;
  retry_count: number;
};

const INSPECTION_SELECT = "id, submission_id, status, retry_count";

function workdirFor(inspectionId: string): string {
  return join("scripts", "output", "submission-inspections", inspectionId);
}

async function updateInspection(id: string, patch: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("submission_inspections").update(patch).eq("id", id);
  if (error) throw new Error(`submission_inspections 更新に失敗: ${error.message}`);
}

/** 未完了ジョブを1件クレームする（他ワーカーとの二重実行防止。scripts/video/worker.tsと同じ方式） */
async function claimNextJob(): Promise<InspectionRow | null> {
  const supabase = getSupabaseAdmin();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  const { data: candidates, error } = await supabase
    .from("submission_inspections")
    .select(`${INSPECTION_SELECT}, locked_at`)
    .or(CLAIMABLE_FILTER)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`検品ジョブ取得に失敗: ${error.message}`);

  for (const candidate of candidates ?? []) {
    const isLocked = candidate.locked_at && candidate.locked_at > staleBefore;
    if (isLocked) continue;
    const { data: claimed, error: claimErr } = await supabase
      .from("submission_inspections")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select(INSPECTION_SELECT)
      .maybeSingle();
    if (claimErr) continue;
    if (claimed) return claimed as InspectionRow;
  }
  return null;
}

interface Context {
  filePath: string;
  fileName: string | null;
  target: InspectionTarget | null;
}

/** 対象提出物と、突き合わせ先（正解データ or 完成見本）を取得する */
async function loadContext(submissionId: string): Promise<Context> {
  const supabase = getSupabaseAdmin();

  const { data: submission, error: subErr } = await supabase
    .from("submissions")
    .select("file_path, file_name, assignment_id")
    .eq("id", submissionId)
    .single();
  if (subErr || !submission) throw new Error(`submissions取得に失敗: ${subErr?.message}`);
  if (!submission.file_path) throw new Error("提出物にファイルがありません");

  const { data: assignment, error: asErr } = await supabase
    .from("task_assignments")
    .select("task_id")
    .eq("id", submission.assignment_id)
    .single();
  if (asErr || !assignment) throw new Error(`task_assignments取得に失敗: ${asErr?.message}`);

  return {
    filePath: submission.file_path,
    fileName: submission.file_name,
    target: await loadInspectionTarget(supabase, assignment.task_id),
  };
}

/** Storage のファイルを workdir に保存し、workdir 内の相対ファイル名を返す */
async function downloadTo(bucket: string, path: string, localName: string, workdir: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`${bucket}/${path} のダウンロードに失敗: ${error?.message}`);
  writeFileSync(join(workdir, localName), Buffer.from(await data.arrayBuffer()));
  return localName;
}

async function downloadBuffer(bucket: string, path: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`${bucket}/${path} のダウンロードに失敗: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

function probeAll(file: string, workdir: string): ProbeResult {
  const streams = probeStreams(file, workdir);
  const volume = probeVolumeDb(file, workdir);
  return {
    durationSec: streams.durationSec,
    width: streams.width,
    height: streams.height,
    hasVideo: streams.hasVideo,
    hasAudio: streams.hasAudio,
    meanVolumeDb: volume.meanVolumeDb,
  };
}

function safeLocalName(fileName: string | null, fallback: string): string {
  return fileName ? fileName.replace(/[^\w.\-]+/g, "_") : fallback;
}

/** 正解データ表（video_jobs）との突き合わせ */
function compareWithTemplate(probe: ProbeResult, answerData: TemplateAnswerData): CheckItem[] {
  assertValidAnswerData(answerData);
  return compareProbeToAnswer(probe, answerData, getTemplateConfig(answerData.templateType));
}

/** 完成見本との突き合わせ（実測比較＋セリフ音声の構成照合） */
async function compareWithSample(
  submissionLocal: string,
  probe: ProbeResult,
  target: Extract<InspectionTarget, { kind: "sample" }>,
  workdir: string,
): Promise<CheckItem[]> {
  const sampleLocal = await downloadTo("materials", target.samplePath, "sample.mp4", workdir);
  const sampleProbe = probeAll(sampleLocal, workdir);
  const checks = compareProbeToSample(probe, sampleProbe);

  if (!target.assetsPath) return checks;
  const assetsZip = await downloadBuffer("materials", target.assetsPath);
  const structure = runStructureCheck({
    workdir,
    sampleFile: sampleLocal,
    submissionFile: submissionLocal,
    assetsZip,
  });
  if (structure.details.length > 0) {
    const weakest = Math.min(...structure.details.map((d) => d.inSample?.score ?? 0));
    console.log(
      `  構成照合: セリフ ${structure.details.filter((d) => d.inSample).length}/${structure.details.length}本を見本で確認（最低スコア ${weakest.toFixed(2)}）`,
    );
  }

  // 字幕照合。作業指示一覧は ZIP 内の CSV を優先し、無ければ案件の教材（revision_note）を使う
  const telop = await runTelopCheck({
    workdir,
    submissionFile: submissionLocal,
    instructionText: readInstructionCsv(assetsZip) ?? target.instructionText,
    voices: structure.details,
    voiceDurations: Object.fromEntries(structure.details.map((d) => [d.name, d.durationSec])),
  });
  if (telop.skippedReason) console.log(`  字幕照合: ${telop.skippedReason}`);
  else console.log(`  字幕照合: セリフ ${telop.observations.length}本の字幕を確認`);

  // 見本フレーム照合（オープニング／エンディング／場面の映像／字幕の位置・大きさ）
  const frames = await runFrameCheck({
    workdir,
    sampleFile: sampleLocal,
    submissionFile: submissionLocal,
    sampleDurationSec: sampleProbe.durationSec,
    submissionDurationSec: probe.durationSec,
    voices: structure.details,
  });
  if (frames.skippedReason) console.log(`  映像照合: ${frames.skippedReason}`);
  else console.log(`  映像照合: ${frames.frames.length}か所のフレームを見本と比較`);

  return [...checks, ...structure.checks, ...telop.checks, ...frames.checks];
}

/** 支給素材ZIPの 作業指示一覧.csv（あれば） */
function readInstructionCsv(assetsZip: Buffer): string | null {
  const entry = readZipEntries(assetsZip, (name) => /(^|\/)作業指示一覧\.csv$/.test(name))[0];
  return entry ? entry.data.toString("utf8") : null;
}

async function processJob(job: InspectionRow): Promise<void> {
  const inspectionId = job.id;
  const workdir = workdirFor(inspectionId);
  mkdirSync(workdir, { recursive: true });

  let currentStage: "probing" | "comparing" = "probing";

  try {
    await updateInspection(inspectionId, { status: "probing", progress: 10, started_at: new Date().toISOString() });

    const { filePath, fileName, target } = await loadContext(job.submission_id);
    if (!target) {
      await updateInspection(inspectionId, {
        status: "skipped",
        progress: 100,
        completed_at: new Date().toISOString(),
        locked_by: null,
        locked_at: null,
      });
      console.log(`検品 ${inspectionId}: 完成見本も正解データも無いためスキップしました`);
      return;
    }

    const submissionLocal = await downloadTo("submissions", filePath, safeLocalName(fileName, "submission.mp4"), workdir);
    const probeResult = probeAll(submissionLocal, workdir);

    currentStage = "comparing";
    await updateInspection(inspectionId, { status: "comparing", progress: 50, probe_result: probeResult });

    const checks =
      target.kind === "template"
        ? compareWithTemplate(probeResult, target.answerData)
        : await compareWithSample(submissionLocal, probeResult, target, workdir);
    const checkResult: CheckResult = { checks, autoScore: computeAutoScore(checks) };

    // 結果を先に保存するが、status は comparing のまま。ここで落ちても次のワーカーが拾い直せる
    await updateInspection(inspectionId, { progress: 90, check_result: checkResult });

    // AIレビュー下書きへ反映（NGがあれば自動差し戻し）。
    // 反映に失敗しても検品結果は残し、completed にして error に理由を書く（無限に拾い直さない）
    let applyError: string | null = null;
    try {
      const applied = await applyInspectionResult(job.submission_id, checkResult);
      const note = applied.note ? `（${applied.note}）` : "";
      console.log(
        `検品 ${inspectionId} が完了しました（自動採点 ${checkResult.autoScore}点、` +
          `${applied.autoReturned ? `自動差し戻し: ${applied.reasons.length}件` : "職員の承認待ち"}${note}）`,
      );
    } catch (err) {
      applyError = err instanceof Error ? err.message : String(err);
      console.error(`検品 ${inspectionId}: レビューへの反映に失敗しました（検品結果は保存済み）:`, applyError);
    }

    await updateInspection(inspectionId, {
      status: "completed",
      progress: 100,
      error: applyError ? `レビューへの反映に失敗: ${applyError}` : null,
      completed_at: new Date().toISOString(),
      locked_by: null,
      locked_at: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`検品 ${inspectionId} が失敗しました:`, message);
    await updateInspection(inspectionId, {
      status: "failed",
      error: message,
      error_stage: currentStage,
      retry_count: job.retry_count + 1,
      locked_by: null,
      locked_at: null,
    });
  }
}

async function drainJobs(): Promise<number> {
  let processed = 0;
  for (;;) {
    const job = await claimNextJob();
    if (!job) break;
    processed += 1;
    console.log(`検品 ${job.id} を処理します`);
    await processJob(job);
  }
  return processed;
}

async function main() {
  const jobIdArg = process.argv.includes("--job") ? process.argv[process.argv.indexOf("--job") + 1] : null;
  const watch = process.argv.includes("--watch");

  if (jobIdArg) {
    // 常駐ワーカーが処理中のジョブを横取りしない（同じ作業フォルダに二重に書くと壊れる）
    const supabase = getSupabaseAdmin();
    const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
    const { data: job, error } = await supabase
      .from("submission_inspections")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString() })
      .eq("id", jobIdArg)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select(INSPECTION_SELECT)
      .maybeSingle();
    if (error || !job) {
      console.error(
        error
          ? `指定ジョブの取得に失敗: ${error.message}`
          : "指定ジョブが見つからないか、別のワーカーが処理中です（15分待つと引き継げます）",
      );
      process.exit(1);
    }
    await processJob(job as InspectionRow);
    return;
  }

  if (watch) {
    console.log(`検品ワーカーを watch モードで起動しました（${POLL_INTERVAL_MS / 1000}秒間隔）。停止は Ctrl+C`);
    let shuttingDown = false;
    process.on("SIGTERM", () => {
      shuttingDown = true;
    });
    process.on("SIGINT", () => {
      shuttingDown = true;
    });
    for (;;) {
      try {
        await drainJobs();
      } catch (err) {
        console.error("ポーリング中にエラー:", err instanceof Error ? err.message : err);
      }
      if (shuttingDown) break;
      await sleep(POLL_INTERVAL_MS);
    }
    return;
  }

  const processed = await drainJobs();
  if (!processed) console.log("処理待ちの検品ジョブはありません");
}

main().catch((err) => {
  console.error("検品ワーカーの実行に失敗しました:", err);
  process.exit(1);
});
