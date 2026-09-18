// SCENE動画案件ジョブのローカルワーカー。
//   scene_jobs の pending を1件ずつ拾い、テーマ→設計図→完成見本→素材→手順書→案件登録 を実行。
//   ffmpeg / sharp / Gemini が必要（Vercel等では動かない。職員PCで常駐する）。
//   使い方: npm run scene:worker            （1回だけ全pendingを処理）
//           npm run scene:worker -- --watch  （常駐してポーリング）
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateVideoProject } from "@/lib/scene/generate";
import { validateVideoProject } from "@/lib/scene/validate";
import type { SceneJob, SceneJobStatus } from "@/lib/types";
import { registerSceneTask } from "./registerSceneTask";

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
// レンダ中の作業ファイル（1案件で数万枚のフレームPNG）は OneDrive 等の同期フォルダ外に置く。
// プロジェクトが OneDrive 配下にあると、同期中のファイルを消せず EPERM で案件が失敗する。
const WORK_ROOT = (process.env.SCENE_WORK_ROOT || join(tmpdir(), "kizuna-scene")).replace(/\\/g, "/");
const WORK_DIR = `${WORK_ROOT}/work`;
const VOX_DIR = `${WORK_ROOT}/vox`;
// 同期ソフトやウイルス対策が一瞬ファイルを掴んでいても消せるように、少し待って再試行する
const RM_OPTS = { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 } as const;

function sb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function runScript(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync("node", args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) throw new Error(`スクリプト失敗: node ${args.join(" ")}`);
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
  runScript(["poc/scene/render_project.mjs", projectPath, videoPath], { ...workEnv, ...(genNotes ? { GEN_NOTES: genNotes } : {}) });

  // 3) no-telop素材の書き出し
  await setStatus(client, job.id, "building_materials", 60);
  runScript(["poc/scene/build_materials.mjs", projectPath, pkgDir], { ...workEnv, SAMPLE_VIDEO: videoPath });

  // 4) 手順書・依頼書・タイムライン・チェックリスト生成
  await setStatus(client, job.id, "building_manual", 78);
  runScript(["poc/scene/build_manual.mjs", pkgDir]);
  runScript(["poc/scene/build_app_task.mjs", pkgDir]);

  // 5) 案件として登録
  await setStatus(client, job.id, "registering_task", 88);
  const { taskId, artifacts } = await registerSceneTask(client, {
    pkgDir,
    staffId: job.created_by,
    difficulty: job.difficulty,
  });

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
    try {
      await processJob(client, job);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ❌ 失敗: ${msg}`);
      const { data: cur } = await client.from("scene_jobs").select("status").eq("id", job.id).maybeSingle();
      await client
        .from("scene_jobs")
        .update({ status: "failed", error: msg, error_stage: (cur?.status as SceneJobStatus) ?? null })
        .eq("id", job.id);
      await client.from("scene_job_events").insert({ job_id: job.id, stage: "failed", event: "failed", detail: msg });
    }
  }
}

async function main() {
  const client = sb();
  const watch = process.argv.includes("--watch");
  if (!process.env.GEMINI_API_KEY) console.warn("⚠ GEMINI_API_KEY 未設定：音声・生成がmock/無音になります");
  console.log(`SCENEワーカー起動（${WORKER_ID}）${watch ? " watchモード" : ""}`);
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
