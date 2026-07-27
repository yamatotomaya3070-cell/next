/**
 * 動画案件生成ワーカー。
 *
 * video_jobs テーブルをポーリングし、未完了ジョブを1件ずつ工程どおりに処理する。
 * Windows SAPI（TTS）と ffmpeg に依存するため、この処理は Vercel 等の
 * サーバーレス環境では実行できない。管理画面はジョブの「登録」のみ行い、
 * 実処理はこのワーカーを ffmpeg/TTS が使えるマシン（現状はこの開発機）で
 * 手動 or タスクスケジューラから実行する運用を前提にする。
 *
 * 使い方:
 *   npx tsx scripts/video/worker.ts            # 未完了ジョブを全件処理して終了
 *   npx tsx scripts/video/worker.ts --job <id>  # 指定ジョブのみ処理
 *   npx tsx scripts/video/worker.ts --watch     # 常駐。定期ポーリングして処理し続ける（Docker常駐用）
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { loadEnvLocal } from "./env";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { runPipeline, PIPELINE_STAGES, type PipelineStage } from "./pipeline";
import {
  getTemplateConfig,
  isTemplateImplemented,
  validateTemplateScript,
  type AnyVideoScript,
  type VideoTemplateType,
} from "../../src/lib/video/templates";
import type { ManualStep } from "../../src/lib/types";

loadEnvLocal();

const WORKER_ID = `${hostname()}-${process.pid}`;
const STALE_LOCK_MS = 15 * 60 * 1000; // 15分以上ロックが更新されないジョブは奪って再開する
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS) || 15_000; // --watch 時のポーリング間隔

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** VOICEVOX エンジンの起動待ち（コンテナ同時起動時のコールドスタート対策） */
async function waitForVoicevox(): Promise<void> {
  const url = process.env.VOICEVOX_URL;
  if (!url) return;
  const base = url.replace(/\/$/, "");
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      const res = await fetch(`${base}/version`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch {
      // 未起動。リトライする
    }
    if (Date.now() > deadline) {
      console.error(`VOICEVOX (${base}) に接続できません。エンジンの起動を確認してください`);
      return;
    }
    await sleep(3_000);
  }
}
const ACTIVE_STATUSES = ["pending", ...PIPELINE_STAGES, "registering_task"] as const;

type JobRow = {
  id: string;
  theme: string;
  difficulty: number;
  target_duration_sec: number;
  status: string;
  script: unknown;
  retry_count: number;
  created_by: string | null;
  template_type: VideoTemplateType;
};

function workdirFor(jobId: string): string {
  return join("scripts", "output", "video-jobs", jobId);
}

async function logEvent(jobId: string, stage: string, event: "started" | "completed" | "failed" | "skipped", detail?: string, durationMs?: number) {
  const supabase = getSupabaseAdmin();
  await supabase.from("video_job_events").insert({
    job_id: jobId,
    stage,
    event,
    detail: detail?.slice(0, 2000) ?? null,
    duration_ms: durationMs ?? null,
  });
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("video_jobs").update(patch).eq("id", jobId);
  if (error) throw new Error(`video_jobs 更新に失敗: ${error.message}`);
}

const JOB_SELECT =
  "id, theme, difficulty, target_duration_sec, status, script, retry_count, created_by, template_type";

/** 未完了ジョブを1件クレームする（他ワーカーとの二重実行防止） */
async function claimNextJob(): Promise<JobRow | null> {
  const supabase = getSupabaseAdmin();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  const { data: candidates, error } = await supabase
    .from("video_jobs")
    .select(`${JOB_SELECT}, locked_at`)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`ジョブ取得に失敗: ${error.message}`);

  for (const candidate of candidates ?? []) {
    const isLocked = candidate.locked_at && candidate.locked_at > staleBefore;
    if (isLocked) continue;
    const { data: claimed, error: claimErr } = await supabase
      .from("video_jobs")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select(JOB_SELECT)
      .maybeSingle();
    if (claimErr) continue;
    if (claimed) return claimed as JobRow;
  }
  return null;
}

async function registerTask(jobId: string, job: JobRow, output: Awaited<ReturnType<typeof runPipeline>>) {
  const supabase = getSupabaseAdmin();
  const config = getTemplateConfig(job.template_type);
  const fs = await import("node:fs/promises");

  const videoBuffer = await fs.readFile(output.videoPath);
  const videoPath = `video-jobs/${jobId}/sample.mp4`;
  const { error: upVideoErr } = await supabase.storage
    .from("materials")
    .upload(videoPath, videoBuffer, { contentType: "video/mp4", upsert: true });
  if (upVideoErr) throw new Error(`完成見本のアップロードに失敗: ${upVideoErr.message}`);

  let rawTakePath: string | null = null;
  if (output.rawTakeVideoPath) {
    const rawBuffer = await fs.readFile(output.rawTakeVideoPath);
    rawTakePath = `video-jobs/${jobId}/raw_take.mp4`;
    const { error: upRawErr } = await supabase.storage
      .from("materials")
      .upload(rawTakePath, rawBuffer, { contentType: "video/mp4", upsert: true });
    if (upRawErr) throw new Error(`未編集動画のアップロードに失敗: ${upRawErr.message}`);
  }

  const zipBuffer = await fs.readFile(output.pkg.zipPath);
  const zipPath = `video-jobs/${jobId}/assets.zip`;
  const { error: upZipErr } = await supabase.storage
    .from("materials")
    .upload(zipPath, zipBuffer, { contentType: "application/zip", upsert: true });
  if (upZipErr) throw new Error(`素材ZIPのアップロードに失敗: ${upZipErr.message}`);

  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .insert({
      type: "practice",
      status: "draft",
      title: output.script.title,
      summary: output.script.description || null,
      difficulty: job.difficulty,
      skill_tags: config.skillTags,
      estimated_minutes: 30 + job.difficulty * 15,
      due_in_days: 2 + job.difficulty,
      created_by: job.created_by,
    })
    .select("id")
    .single();
  if (tErr || !task) throw new Error(`案件の登録に失敗: ${tErr?.message}`);

  const manualSteps: ManualStep[] = output.pkg.manualSteps;
  const materials = [
    { task_id: task.id, kind: "request_doc", title: "お仕事の依頼書", content: output.pkg.requestDoc, sort_order: 0, generated_by: "ai", is_approved: false },
    { task_id: task.id, kind: "manual", title: "作業のやり方（手順書）", steps: manualSteps, sort_order: 1, generated_by: "ai", is_approved: false },
    { task_id: task.id, kind: "revision_note", title: "編集指示書（タイムライン）", content: output.pkg.instructionDoc, sort_order: 2, generated_by: "ai", is_approved: false },
    { task_id: task.id, kind: "revision_note", title: "納品前チェックリスト", content: JSON.stringify(output.pkg.selfCheckItems), sort_order: 9, generated_by: "ai", is_approved: false },
    { task_id: task.id, kind: "sample", title: "完成見本", media_url: videoPath, content: "完成見本の動画です。編集後の仕上がりの参考にしてください。", sort_order: 3, generated_by: "ai", is_approved: false },
    { task_id: task.id, kind: "source_assets", title: "支給素材一式（ダウンロード）", media_url: zipPath, content: "音声・字幕データ・台本が入ったZIPファイルです。", sort_order: 4, generated_by: "ai", is_approved: false },
    ...(rawTakePath
      ? [{ task_id: task.id, kind: "source_assets", title: "未編集の対談音声（連続収録）", media_url: rawTakePath, content: "カット前の連続収録です。ここから不要な部分を取り除いて仕上げます。", sort_order: 5, generated_by: "ai" as const, is_approved: false }]
      : []),
  ];
  const { error: mErr } = await supabase.from("task_materials").insert(materials);
  if (mErr) throw new Error(`教材の保存に失敗: ${mErr.message}`);

  await updateJob(jobId, {
    task_id: task.id,
    artifacts: { sample_video: videoPath, assets_zip: zipPath, ...(rawTakePath ? { raw_take_video: rawTakePath } : {}) },
  });
}

async function processJob(job: JobRow): Promise<void> {
  const jobId = job.id;
  const workdir = workdirFor(jobId);
  mkdirSync(workdir, { recursive: true });

  if (!isTemplateImplemented(job.template_type)) {
    const message = `テンプレート「${job.template_type}」はまだ生成に対応していません（準備中）`;
    await logEvent(jobId, "generating_script", "failed", message);
    await updateJob(jobId, { status: "failed", error: message, error_stage: "generating_script", locked_by: null, locked_at: null });
    console.error(`ジョブ ${jobId}: ${message}`);
    return;
  }

  let providedScript: AnyVideoScript | undefined;
  if (job.script) {
    const revalidated = validateTemplateScript(job.template_type, job.script);
    if (revalidated.ok && revalidated.script) providedScript = revalidated.script;
  }

  let currentStage: PipelineStage | null = null;
  let currentStageStartedAt = 0;
  const lastStageRef: { stage: PipelineStage | null } = { stage: null };

  try {
    await updateJob(jobId, { status: "pending", started_at: new Date().toISOString(), error: null, error_stage: null });

    const output = await runPipeline({
      templateType: job.template_type,
      theme: job.theme,
      targetDurationSec: job.target_duration_sec,
      workdir,
      providedScript,
      onStage: async (stage, progress) => {
        if (currentStage) {
          await logEvent(jobId, currentStage, "completed", undefined, Date.now() - currentStageStartedAt);
        }
        currentStage = stage;
        currentStageStartedAt = Date.now();
        lastStageRef.stage = stage;
        await logEvent(jobId, stage, "started");
        await updateJob(jobId, { status: stage, progress });
      },
    });

    if (currentStage) {
      await logEvent(jobId, currentStage, "completed", undefined, Date.now() - currentStageStartedAt);
    }

    await logEvent(jobId, "registering_task", "started");
    await updateJob(jobId, {
      status: "registering_task",
      progress: 98,
      script: output.script,
      timeline: output.timeline,
      answer_data: output.pkg.answerData,
      provider: output.provider,
    });
    const registerStart = Date.now();
    await registerTask(jobId, job, output);
    await logEvent(jobId, "registering_task", "completed", undefined, Date.now() - registerStart);

    await updateJob(jobId, { status: "completed", progress: 100, completed_at: new Date().toISOString(), locked_by: null, locked_at: null });
    console.log(`ジョブ ${jobId} が完了しました`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failedStage = lastStageRef.stage ?? "pending";
    console.error(`ジョブ ${jobId} が失敗しました (${failedStage}):`, message);
    await logEvent(jobId, failedStage, "failed", message);
    await updateJob(jobId, {
      status: "failed",
      error: message,
      error_stage: failedStage,
      retry_count: job.retry_count + 1,
      locked_by: null,
      locked_at: null,
    });
  }
}

/** 未完了ジョブが尽きるまで順に処理する。処理したジョブ数を返す */
async function drainJobs(): Promise<number> {
  let processed = 0;
  for (;;) {
    const job = await claimNextJob();
    if (!job) break;
    processed += 1;
    console.log(`ジョブ ${job.id}（${job.theme} / ${job.template_type}）を処理します`);
    await processJob(job);
  }
  return processed;
}

async function main() {
  const jobIdArg = process.argv.includes("--job") ? process.argv[process.argv.indexOf("--job") + 1] : null;
  const watch = process.argv.includes("--watch");

  if (!existsSync(join("assets", "video"))) {
    console.error("共通素材がありません。先に scripts/video/generate-assets.ts を実行してください。");
    process.exit(1);
  }

  await waitForVoicevox();

  if (jobIdArg) {
    const supabase = getSupabaseAdmin();
    const { data: job, error } = await supabase
      .from("video_jobs")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString() })
      .eq("id", jobIdArg)
      .select(JOB_SELECT)
      .maybeSingle();
    if (error || !job) {
      console.error("指定ジョブが見つかりません:", error?.message);
      process.exit(1);
    }
    await processJob(job as JobRow);
    return;
  }

  if (watch) {
    console.log(`watchモードで起動しました（${POLL_INTERVAL_MS / 1000}秒間隔でポーリング）。停止は Ctrl+C`);
    let shuttingDown = false;
    process.on("SIGTERM", () => { shuttingDown = true; });
    process.on("SIGINT", () => { shuttingDown = true; });
    for (;;) {
      try {
        await drainJobs();
      } catch (err) {
        // 個別ジョブの失敗は processJob 内で記録済み。ここに来るのは接続断など。
        console.error("ポーリング中にエラーが発生しました:", err instanceof Error ? err.message : err);
      }
      if (shuttingDown) {
        console.log("シャットダウン要求を受け取りました。終了します");
        break;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    return;
  }

  const processedAny = await drainJobs();
  if (!processedAny) console.log("処理待ちのジョブはありません");
}

main().catch((err) => {
  console.error("ワーカーの実行に失敗しました:", err);
  process.exit(1);
});
