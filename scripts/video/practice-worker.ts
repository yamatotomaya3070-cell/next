/**
 * 練習素材ジョブのレンダリングワーカー（Stage4配線）。
 *
 * practice_jobs をポーリングし、素材mp4一式を書き出して materials バケットへ保存する。
 * ffmpeg と TTS に依存するため Vercel では動かせない。ffmpeg が使えるマシン
 * （開発機 / Docker）で実行する。video_jobs 用 worker.ts と同じ claim/lock パターン。
 *
 * 使い方:
 *   npx tsx scripts/video/practice-worker.ts            # 未処理を全件
 *   npx tsx scripts/video/practice-worker.ts --job <id>  # 指定ジョブのみ
 *   npx tsx scripts/video/practice-worker.ts --watch     # 常駐ポーリング
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";
import { loadEnvLocal } from "./env";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { renderPracticeMaterials } from "./practice-render";
import { STYLE_GUIDE_EXPRESSIONS } from "../../src/lib/style-guide/schema";
import { characterAssetStoragePath, CHARACTER_ASSET_BUCKET } from "../../src/lib/character-assets/schema";
import type { GeneratedPracticeScript } from "../../src/lib/practice-script/schema";
import type { StyleGuideContent } from "../../src/lib/style-guide/schema";

loadEnvLocal();

const WORKER_ID = `${hostname()}-${process.pid}`;
const STALE_LOCK_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS) || 15_000;
const ACTIVE_STATUSES = ["pending", "rendering"];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type PracticeJobRow = {
  id: string;
  theme: string;
  difficulty: string;
  target_seconds: number;
  script: GeneratedPracticeScript;
  style_guide: StyleGuideContent;
  style_guide_id: string | null;
  retry_count: number;
};

const JOB_SELECT =
  "id, theme, difficulty, target_seconds, script, style_guide, style_guide_id, retry_count";

function workdirFor(jobId: string): string {
  return join("scripts", "output", "practice-jobs", jobId);
}

async function updateJob(jobId: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("practice_jobs").update(patch).eq("id", jobId);
  if (error) throw new Error(`practice_jobs 更新に失敗: ${error.message}`);
}

/** 立ち絵(normal)をStorageからダウンロードし、話者キー→ローカルパスの対応を返す */
async function downloadStandingImages(
  job: PracticeJobRow,
  workdir: string,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!job.style_guide_id) return map;
  const supabase = getSupabaseAdmin();
  const standingDir = join(workdir, "standing");
  mkdirSync(standingDir, { recursive: true });

  const normal = STYLE_GUIDE_EXPRESSIONS.includes("normal") ? "normal" : STYLE_GUIDE_EXPRESSIONS[0];
  for (const character of job.style_guide.characters) {
    const path = characterAssetStoragePath(job.style_guide_id, character.key, normal);
    const { data, error } = await supabase.storage.from(CHARACTER_ASSET_BUCKET).download(path);
    if (error || !data) {
      console.warn(`立ち絵が見つかりません（背景＋音声のみで作成）: ${character.key}`);
      continue;
    }
    const localPath = join(standingDir, `${character.key}.png`);
    writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
    map[character.key] = localPath;
  }
  return map;
}

async function uploadArtifact(
  jobId: string,
  localPath: string,
  name: string,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const storagePath = `practice-jobs/${jobId}/${name}`;
  const buffer = await readFile(localPath);
  const { error } = await supabase.storage
    .from("materials")
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`${name} のアップロードに失敗: ${error.message}`);
  return storagePath;
}

async function processJob(job: PracticeJobRow): Promise<void> {
  const jobId = job.id;
  const workdir = workdirFor(jobId);
  mkdirSync(workdir, { recursive: true });

  try {
    await updateJob(jobId, { status: "rendering", progress: 20, error: null, error_stage: null });

    const standingImages = await downloadStandingImages(job, workdir);
    await updateJob(jobId, { progress: 40 });

    const result = await renderPracticeMaterials({
      workdir,
      script: job.script,
      styleGuide: job.style_guide,
      difficulty: job.difficulty,
      standingImages,
    });
    await updateJob(jobId, { progress: 80 });

    const samplePath = await uploadArtifact(jobId, result.samplePath, "sample.mp4", "video/mp4");
    const zipPath = await uploadArtifact(jobId, result.zipPath, "assets.zip", "application/zip");

    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      artifacts: { sample_video: samplePath, assets_zip: zipPath },
      answer_data: result.answerData,
      completed_at: new Date().toISOString(),
      locked_by: null,
      locked_at: null,
    });
    console.log(`練習ジョブ ${jobId}（クリップ${result.clipFiles.length}本）が完了しました`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`練習ジョブ ${jobId} が失敗しました:`, message);
    await updateJob(jobId, {
      status: "failed",
      error: message,
      error_stage: "rendering",
      retry_count: job.retry_count + 1,
      locked_by: null,
      locked_at: null,
    });
  }
}

async function claimNextJob(): Promise<PracticeJobRow | null> {
  const supabase = getSupabaseAdmin();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data: candidates, error } = await supabase
    .from("practice_jobs")
    .select(`${JOB_SELECT}, locked_at`)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`ジョブ取得に失敗: ${error.message}`);

  for (const candidate of candidates ?? []) {
    const c = candidate as PracticeJobRow & { locked_at: string | null };
    if (c.locked_at && c.locked_at > staleBefore) continue;
    const { data: claimed } = await supabase
      .from("practice_jobs")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString() })
      .eq("id", c.id)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select(JOB_SELECT)
      .maybeSingle();
    if (claimed) return claimed as PracticeJobRow;
  }
  return null;
}

async function drainJobs(): Promise<number> {
  let processed = 0;
  for (;;) {
    const job = await claimNextJob();
    if (!job) break;
    processed += 1;
    console.log(`練習ジョブ ${job.id}（${job.theme}）を処理します`);
    await processJob(job);
  }
  return processed;
}

async function main() {
  const jobIdArg = process.argv.includes("--job") ? process.argv[process.argv.indexOf("--job") + 1] : null;
  const watch = process.argv.includes("--watch");

  if (!existsSync(join("assets", "video", "bg_default.png"))) {
    console.error("共通素材がありません。先に scripts/video/generate-assets.ts を実行してください。");
    process.exit(1);
  }

  if (jobIdArg) {
    const supabase = getSupabaseAdmin();
    const { data: job, error } = await supabase
      .from("practice_jobs")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString() })
      .eq("id", jobIdArg)
      .select(JOB_SELECT)
      .maybeSingle();
    if (error || !job) {
      console.error("指定ジョブが見つかりません:", error?.message);
      process.exit(1);
    }
    await processJob(job as PracticeJobRow);
    return;
  }

  if (watch) {
    console.log(`watchモードで起動しました（${POLL_INTERVAL_MS / 1000}秒間隔）。停止は Ctrl+C`);
    let shuttingDown = false;
    process.on("SIGTERM", () => { shuttingDown = true; });
    process.on("SIGINT", () => { shuttingDown = true; });
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
  if (!processed) console.log("処理待ちの練習ジョブはありません");
}

main().catch((err) => {
  console.error("ワーカーの実行に失敗しました:", err);
  process.exit(1);
});
