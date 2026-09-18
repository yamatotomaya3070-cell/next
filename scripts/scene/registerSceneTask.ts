// 就労者パッケージ（build_materials/build_manual/build_app_task の出力フォルダ）→
// アプリの案件(tasks/task_materials)として登録する再利用関数。ワーカーから呼ぶ。
// 完成見本は sample、支給素材一式(zip)は source_assets として materials バケットに置く。
// 割り当ては行わない（職員が案件管理から配布する）。
import { readFileSync, existsSync } from "node:fs";
import { zipPaths } from "./zipFolder";
import { verifyPackage } from "./verifyPackage";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RegisterResult {
  taskId: string;
  artifacts: { sample_video: string; assets_zip: string };
}

// 就労者へ配る素材一式。完成見本.mp4 と内部JSON（素材一覧.json / app_task.json）は入れない。
const SUPPLIED = ["素材", "作業指示一覧.csv", "はじめに.txt"];

function zipSuppliedAssets(pkgDir: string): string {
  const missing = SUPPLIED.filter((p) => !existsSync(`${pkgDir}/${p}`));
  if (missing.length > 0) throw new Error(`素材パッケージに足りないもの: ${missing.join(", ")}`);
  const zipFile = `${pkgDir}/支給素材一式.zip`;
  zipPaths(pkgDir, SUPPLIED, zipFile);
  return zipFile;
}

async function upload(sb: SupabaseClient, path: string, file: string, contentType: string) {
  const buf = readFileSync(file);
  const { error } = await sb.storage.from("materials").upload(path, buf, { contentType, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

export async function registerSceneTask(
  sb: SupabaseClient,
  opts: { pkgDir: string; staffId: string | null; difficulty: number },
): Promise<RegisterResult> {
  const { pkgDir, staffId, difficulty } = opts;
  // 支給素材だけで完成見本が作れない案件は、ここで止めて登録しない
  const check = verifyPackage(pkgDir);
  console.log(`  関門OK: 並べた長さ ${check.totalFrames}f / 完成見本 ${check.sampleFrames}f / セリフ ${check.voices}本`);
  const P = JSON.parse(readFileSync(`${pkgDir}/app_task.json`, "utf8"));

  const taskId = randomUUID();
  const base = `scene-nisa/${taskId}`;
  const sampleFile = `${pkgDir}/完成見本.mp4`;
  if (!existsSync(sampleFile)) throw new Error("完成見本.mp4 が見つかりません");
  const zipFile = zipSuppliedAssets(pkgDir);

  // 1) tasks
  const task = {
    id: taskId,
    type: "practice",
    status: "published",
    title: P.task.title,
    summary: P.task.summary,
    difficulty,
    skill_tags: P.task.skill_tags,
    estimated_minutes: P.task.estimated_minutes,
    due_in_days: P.task.due_in_days,
    created_by: staffId,
  };
  const t = await sb.from("tasks").insert(task).select("id").single();
  if (t.error) throw new Error("tasks insert: " + t.error.message);

  // 2) ファイルアップロード
  await upload(sb, `${base}/sample.mp4`, sampleFile, "video/mp4");
  await upload(sb, `${base}/assets.zip`, zipFile, "application/zip");

  // 3) task_materials
  const mats = [
    { kind: "request_doc", title: "お仕事の依頼書", content: P.requestDoc, steps: null, media_url: null, sort_order: 0 },
    { kind: "revision_note", title: "作業指示一覧", content: P.timelineMd, steps: null, media_url: null, sort_order: 2 },
    { kind: "sample", title: "完成見本", content: "完成見本の動画です。編集後の仕上がりの参考にしてください。", steps: null, media_url: `${base}/sample.mp4`, sort_order: 3 },
    { kind: "source_assets", title: "支給素材一式（ダウンロード）", content: "映像・音声・BGM・立ち絵・作業指示一覧が入ったZIPファイルです。「素材」フォルダをそのまま DaVinci に入れます。", steps: null, media_url: `${base}/assets.zip`, sort_order: 4 },
    { kind: "revision_note", title: "納品前チェックリスト", content: JSON.stringify(P.checklist), steps: null, media_url: null, sort_order: 9 },
  ].map((m) => ({
    ...m,
    task_id: taskId,
    generated_by: "staff",
    is_approved: true,
    // 完成見本(sample)は「答え」なので利用者に見せない（スタッフ専用）。他は通常公開。
    visible_before_submission: m.kind !== "sample",
  }));
  const mi = await sb.from("task_materials").insert(mats);
  if (mi.error) throw new Error("materials insert: " + mi.error.message);

  return { taskId, artifacts: { sample_video: `${base}/sample.mp4`, assets_zip: `${base}/assets.zip` } };
}
