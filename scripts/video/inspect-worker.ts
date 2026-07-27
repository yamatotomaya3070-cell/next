/**
 * 提出動画の機械検品ワーカー。
 *
 * submission_inspections テーブルをポーリングし、未完了ジョブを1件ずつ処理する。
 * ffmpeg/ffprobe に依存するため、scripts/video/worker.ts と同じ理由で
 * Vercel 等のサーバーレス環境では実行できない。提出時（submitWork）は
 * submission_inspections に pending 行を作るだけで、実処理はこのワーカーを
 * ffmpeg のあるマシンで手動 or タスクスケジューラから実行する運用を前提にする。
 *
 * 使い方:
 *   npx tsx scripts/video/inspect-worker.ts            # 未完了ジョブを全件処理して終了
 *   npx tsx scripts/video/inspect-worker.ts --job <id>  # 指定ジョブのみ処理
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { loadEnvLocal } from "./env";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { probeStreams, probeVolumeDb } from "./exec";
import { getTemplateConfig, VIDEO_TEMPLATE_TYPES } from "../../src/lib/video/templates";
import { compareProbeToAnswer } from "../../src/lib/video/inspection/compare";
import { computeAutoScore } from "../../src/lib/video/inspection/score";
import type { CheckResult, ProbeResult } from "../../src/lib/video/inspection/types";
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
const ACTIVE_STATUSES = ["pending", "probing", "comparing"] as const;

const CHECK_STATUS_LABEL: Record<string, string> = { pass: "OK", fail: "NG", unknown: "不明" };

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
    .in("status", ACTIVE_STATUSES as unknown as string[])
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

/** 対象提出物と、突き合わせに使う正解データ(video_jobs.answer_data)を取得する */
async function loadContext(
  submissionId: string,
): Promise<{ filePath: string; fileName: string | null; answerData: TemplateAnswerData | null }> {
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

  const { data: videoJob, error: vjErr } = await supabase
    .from("video_jobs")
    .select("answer_data")
    .eq("task_id", assignment.task_id)
    .not("answer_data", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vjErr) throw new Error(`video_jobs取得に失敗: ${vjErr.message}`);

  return {
    filePath: submission.file_path,
    fileName: submission.file_name,
    answerData: (videoJob?.answer_data as TemplateAnswerData | undefined) ?? null,
  };
}

/** submissionsバケットから提出動画をローカルにダウンロードし、workdir内の相対ファイル名を返す */
async function downloadSubmission(filePath: string, fileName: string | null, workdir: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from("submissions").download(filePath);
  if (error || !data) throw new Error(`提出動画のダウンロードに失敗: ${error?.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  const localName = fileName ? fileName.replace(/[^\w.\-]+/g, "_") : "submission.mp4";
  writeFileSync(join(workdir, localName), buffer);
  return localName;
}

/** 機械検品結果を、対応するAI採点(feedback)の criteria に "machine_check" 項目として追記する */
async function appendMachineCheckToFeedback(submissionId: string, checkResult: CheckResult) {
  const supabase = getSupabaseAdmin();
  const { data: feedback, error } = await supabase
    .from("feedback")
    .select("id, criteria")
    .eq("submission_id", submissionId)
    .eq("source", "ai")
    .maybeSingle();
  if (error || !feedback) return; // AI採点が無ければ何もしない

  const comment = checkResult.checks
    .map((c) => `${c.label}: ${CHECK_STATUS_LABEL[c.status]}（実測: ${c.actual} / 期待: ${c.expected}）`)
    .join(" / ");
  const existingCriteria = (Array.isArray(feedback.criteria) ? feedback.criteria : []) as Array<{ key?: string }>;
  const criteria = [
    ...existingCriteria.filter((c) => c.key !== "machine_check"),
    { key: "machine_check", label: "機械検品（自動）", score: checkResult.autoScore, comment },
  ];
  await supabase.from("feedback").update({ criteria }).eq("id", feedback.id);
}

async function processJob(job: InspectionRow): Promise<void> {
  const inspectionId = job.id;
  const workdir = workdirFor(inspectionId);
  mkdirSync(workdir, { recursive: true });

  let currentStage: "probing" | "comparing" = "probing";

  try {
    await updateInspection(inspectionId, { status: "probing", progress: 10 });

    const { filePath, fileName, answerData } = await loadContext(job.submission_id);
    if (!answerData) {
      await updateInspection(inspectionId, {
        status: "skipped",
        progress: 100,
        completed_at: new Date().toISOString(),
        locked_by: null,
        locked_at: null,
      });
      console.log(`検品 ${inspectionId}: 正解データが見つからないためスキップしました`);
      return;
    }
    assertValidAnswerData(answerData);

    const localName = await downloadSubmission(filePath, fileName, workdir);
    const streams = probeStreams(localName, workdir);
    const volume = probeVolumeDb(localName, workdir);
    const probeResult: ProbeResult = {
      durationSec: streams.durationSec,
      width: streams.width,
      height: streams.height,
      hasVideo: streams.hasVideo,
      hasAudio: streams.hasAudio,
      meanVolumeDb: volume.meanVolumeDb,
    };

    currentStage = "comparing";
    await updateInspection(inspectionId, { status: "comparing", progress: 60, probe_result: probeResult });

    const templateConfig = getTemplateConfig(answerData.templateType);
    const checks = compareProbeToAnswer(probeResult, answerData, templateConfig);
    const checkResult: CheckResult = { checks, autoScore: computeAutoScore(checks) };

    await appendMachineCheckToFeedback(job.submission_id, checkResult);

    await updateInspection(inspectionId, {
      status: "completed",
      progress: 100,
      check_result: checkResult,
      completed_at: new Date().toISOString(),
      locked_by: null,
      locked_at: null,
    });
    console.log(`検品 ${inspectionId} が完了しました（自動採点: ${checkResult.autoScore}点）`);
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

async function main() {
  const jobIdArg = process.argv.includes("--job") ? process.argv[process.argv.indexOf("--job") + 1] : null;

  if (jobIdArg) {
    const supabase = getSupabaseAdmin();
    const { data: job, error } = await supabase
      .from("submission_inspections")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString() })
      .eq("id", jobIdArg)
      .select(INSPECTION_SELECT)
      .maybeSingle();
    if (error || !job) {
      console.error("指定ジョブが見つかりません:", error?.message);
      process.exit(1);
    }
    await processJob(job as InspectionRow);
    return;
  }

  let processedAny = false;
  for (;;) {
    const job = await claimNextJob();
    if (!job) break;
    processedAny = true;
    console.log(`検品 ${job.id} を処理します`);
    await processJob(job);
  }
  if (!processedAny) console.log("処理待ちの検品ジョブはありません");
}

main().catch((err) => {
  console.error("検品ワーカーの実行に失敗しました:", err);
  process.exit(1);
});
