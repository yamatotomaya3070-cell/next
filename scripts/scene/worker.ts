// SCENE動画案件ジョブのローカルワーカー。
//   scene_jobs の pending を1件ずつ拾い、テーマ→設計図→完成見本→素材→手順書→案件登録 を実行。
//   ffmpeg / sharp / Gemini が必要（Vercel等では動かない。職員PCで常駐する）。
//   使い方: npm run scene:worker            （1回だけ全pendingを処理）
//           npm run scene:worker -- --watch  （常駐してポーリング）
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { freemem, hostname, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateVideoProject } from "@/lib/scene/generate";
import { validateVideoProject } from "@/lib/scene/validate";
import { HEARTBEAT_MS } from "@/lib/scene/stepFailure";
import { SCENE_JOB_STATUS_LABELS, type SceneJob, type SceneJobStatus } from "@/lib/types";
import { registerRawSceneTask, registerSceneTask } from "./registerSceneTask";
import { buildRawPackage, rawPackageSummary } from "./buildRawPackage";
import { verifyPackage } from "./verifyPackage";
import { logLine, runStep, StepError } from "./runStep";

// ローカル開発では .env.local を読む（tsx直接実行では自動読込されないため）。
// Docker本番では docker-compose の env_file(.env) で環境変数が渡るため、無くてもよい。
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const WORKER_ID = `${hostname()}:${process.pid}`;
const POLL_MS = Number(process.env.SCENE_WORKER_POLL_MS ?? 15000);
const OUT_ROOT = "poc/scene/out";
// 作る案件の形。raw＝録ったままの声を受講者が切って仕上げる（既定）／legacy＝素材が自動で並ぶ以前の形
const PACKAGE_MODE = process.env.SCENE_PACKAGE_MODE === "legacy" ? "legacy" : "raw";
// レンダ中の作業ファイル（1案件で数万枚のフレームPNG）は OneDrive 等の同期フォルダ外に置く。
// プロジェクトが OneDrive 配下にあると、同期中のファイルを消せず EPERM で案件が失敗する。
const WORK_ROOT = (process.env.SCENE_WORK_ROOT || join(tmpdir(), "kizuna-scene")).replace(/\\/g, "/");
const WORK_DIR = `${WORK_ROOT}/work`;
const VOX_DIR = `${WORK_ROOT}/vox`;
// 同期ソフトやウイルス対策が一瞬ファイルを掴んでいても消せるように、少し待って再試行する
const RM_OPTS = { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 } as const;
// このPCでの処理の記録。止まった理由はアプリの画面にも出すが、PCにも残して後から見られるようにする
const LOG_FILE = `${WORK_ROOT}/scene-worker.log`;

function sb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function runScript(step: string, args: string[], env: Record<string, string> = {}) {
  return runStep(step, "node", args, { env, logFile: LOG_FILE });
}

/** 工程の外で起きたエラー（AI生成・DB など）にも、PC名と工程名を付ける */
function describeOtherError(e: unknown, stage: SceneJobStatus | null): string {
  if (e instanceof StepError) return e.message;
  const msg = e instanceof Error ? e.message : String(e);
  const where = stage ? SCENE_JOB_STATUS_LABELS[stage] : "準備";
  const mem = `${Math.round(freemem() / 1048576)}MB / 全体 ${Math.round(totalmem() / 1048576)}MB`;
  return [`【${where}】で止まりました（作業PC: ${hostname()}）`, `エラー: ${msg}`, `止まったときの空きメモリ: ${mem}`].join("\n");
}

/** 処理中は1分ごとに locked_at を更新する。途絶えたら画面に「作業PCから連絡がない」と出る */
function startHeartbeat(client: SupabaseClient, id: string) {
  const timer = setInterval(() => {
    // Supabase の問い合わせは then を呼ぶまで送られない（void だけだと送られず、画面に「連絡がない」と出ていた）
    client
      .from("scene_jobs")
      .update({ locked_at: new Date().toISOString() })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error(`  連絡（locked_at の更新）に失敗: ${error.message}`);
      });
  }, HEARTBEAT_MS);
  return () => clearInterval(timer);
}

async function setStatus(
  client: SupabaseClient,
  id: string,
  status: SceneJobStatus,
  progress: number,
  extra: Record<string, unknown> = {},
) {
  await client.from("scene_jobs").update({ status, progress, ...extra }).eq("id", id);
  await client.from("scene_job_events").insert({ job_id: id, stage: status, event: "started" });
}

async function processJob(client: SupabaseClient, job: SceneJob) {
  const dir = `${OUT_ROOT}/job_${job.id}`;
  const projectPath = `${dir}/project.json`;
  const videoPath = `${dir}/sample.mp4`;
  const pkgDir = `${dir}/package`;
  const rawDir = `${dir}/package_raw`;
  rmSync(dir, RM_OPTS);
  mkdirSync(dir, { recursive: true });

  // 生成ナレッジ（過去の不備・発音指摘）を取得し、台本生成とTTSの両方に反映する
  const { data: noteRows } = await client
    .from("scene_generation_notes")
    .select("note,term,reading")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const notes = (noteRows ?? []) as { note: string; term: string | null; reading: string | null }[];
  const notesForPrompt = notes.map((n) => n.note).filter(Boolean);
  const genNotes = notes
    .map((n) => (n.term && n.reading ? `「${n.term}」は「${n.reading}」と読む` : n.note))
    .filter(Boolean)
    .join("\n");
  if (notesForPrompt.length) console.log(`  生成ナレッジ ${notesForPrompt.length}件を反映`);

  // 1) 設計図（SCENE）生成
  await setStatus(client, job.id, "generating_scene", 10);
  const { project, provider } = await generateVideoProject({
    theme: job.theme,
    targetMinutes: job.target_minutes,
    audience: job.audience,
    notes: notesForPrompt,
  });
  const report = validateVideoProject(project);
  if (!report.ok) {
    throw new Error(`設計図の検証に失敗: ${report.issues.map((i) => i.message).join(" / ")}`);
  }
  writeFileSync(projectPath, JSON.stringify(project, null, 2), "utf8");
  await client.from("scene_jobs").update({ project, progress: 25 }).eq("id", job.id);
  console.log(`  設計図生成OK（${project.scenes.length}シーン / ${provider}）`);

  // 2) 完成見本レンダリング（音声キャッシュはテーマ依存なので毎回クリア）
  await setStatus(client, job.id, "rendering_video", 30);
  rmSync(VOX_DIR, RM_OPTS);
  rmSync(WORK_DIR, RM_OPTS);
  const workEnv = { SCENE_WORK_DIR: WORK_DIR, SCENE_VOX_DIR: VOX_DIR, SCENE_VISUAL_ASSET_DIR: `${WORK_DIR}/visual_assets` };
  await runScript("完成見本の書き出し", ["poc/scene/render_project.mjs", projectPath, videoPath], { ...workEnv, ...(genNotes ? { GEN_NOTES: genNotes } : {}) });

  // 3) no-telop素材の書き出し
  await setStatus(client, job.id, "building_materials", 60);
  await runScript("素材の書き出し", ["poc/scene/build_materials.mjs", projectPath, pkgDir], { ...workEnv, SAMPLE_VIDEO: videoPath });

  // 4) 依頼書などの文を作る
  await setStatus(client, job.id, "building_manual", 78);
  let registered: Awaited<ReturnType<typeof registerSceneTask>>;
  if (PACKAGE_MODE === "raw") {
    // カット練習の形：まず自動で並べる形が見本どおりに組めることを確かめてから（素材の取り違えを防ぐ）、
    // 1文ずつの声を「録ったままの声」に作りかえる。関門は作業指示一覧（app_task.json）も見るので、先に作る
    await runScript("作業指示一覧の作成（元の素材の確認用）", ["poc/scene/build_app_task.mjs", pkgDir]);
    const check = verifyPackage(pkgDir);
    console.log(`  元の素材OK: セリフ ${check.voices}本`);
    const { key } = buildRawPackage(pkgDir, rawDir, job.id);
    console.log(`  カット練習の素材OK: ${rawPackageSummary(key)}`);
    await setStatus(client, job.id, "registering_task", 88);
    registered = await registerRawSceneTask(client, { pkgDir: rawDir, staffId: job.created_by, difficulty: job.difficulty });
  } else {
    await runScript("手順書の作成", ["poc/scene/build_manual.mjs", pkgDir]);
    await runScript("依頼書・作業指示一覧の作成", ["poc/scene/build_app_task.mjs", pkgDir]);
    await setStatus(client, job.id, "registering_task", 88);
    registered = await registerSceneTask(client, { pkgDir, staffId: job.created_by, difficulty: job.difficulty });
  }
  const { taskId, artifacts } = registered;

  await client
    .from("scene_jobs")
    .update({ status: "completed", progress: 100, task_id: taskId, artifacts, completed_at: new Date().toISOString() })
    .eq("id", job.id);
  await client.from("scene_job_events").insert({ job_id: job.id, stage: "completed", event: "completed" });
  console.log(`  ✅ 完了: task=${taskId}`);
}

async function claimNext(client: SupabaseClient): Promise<SceneJob | null> {
  const { data } = await client
    .from("scene_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);
  const job = (data ?? [])[0] as SceneJob | undefined;
  if (!job) return null;
  // ロック（楽観：pendingのままの行だけ更新）
  const { data: locked } = await client
    .from("scene_jobs")
    .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString(), started_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  return (locked as SceneJob) ?? null;
}

async function drain(client: SupabaseClient) {
  for (;;) {
    const job = await claimNext(client);
    if (!job) break;
    console.log(`\n[job ${job.id}] テーマ「${job.theme}」を処理開始`);
    logLine(LOG_FILE, `[job ${job.id}] 「${job.theme}」を処理開始（${WORKER_ID}）`);
    const stopHeartbeat = startHeartbeat(client, job.id);
    try {
      await processJob(client, job);
      logLine(LOG_FILE, `[job ${job.id}] 完了`);
    } catch (e) {
      const { data: cur } = await client.from("scene_jobs").select("status").eq("id", job.id).maybeSingle();
      const msg = describeOtherError(e, (cur?.status as SceneJobStatus) ?? null);
      console.error(`  ❌ 失敗（記録: ${LOG_FILE}）\n${msg}`);
      if (!(e instanceof StepError)) logLine(LOG_FILE, msg);
      await client
        .from("scene_jobs")
        .update({ status: "failed", error: msg, error_stage: (cur?.status as SceneJobStatus) ?? null })
        .eq("id", job.id);
      await client.from("scene_job_events").insert({ job_id: job.id, stage: "failed", event: "failed", detail: msg });
    } finally {
      stopHeartbeat();
    }
  }
}

async function main() {
  const client = sb();
  const watch = process.argv.includes("--watch");
  if (!process.env.GEMINI_API_KEY) console.warn("⚠ GEMINI_API_KEY 未設定：音声・生成がmock/無音になります");
  mkdirSync(WORK_ROOT, { recursive: true });
  console.log(`SCENEワーカー起動（${WORKER_ID}）${watch ? " watchモード" : ""}　記録: ${LOG_FILE}`);
  await drain(client);
  if (!watch) {
    console.log("pending なし。終了。");
    return;
  }
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    await drain(client);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
