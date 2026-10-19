// 就労者パッケージ（build_materials/build_manual/build_app_task の出力フォルダ）→
// アプリの案件(tasks/task_materials)として登録する再利用関数。ワーカーから呼ぶ。
// 完成見本は sample、支給素材一式(zip)は source_assets として materials バケットに置く。
// 割り当ては行わない（職員が案件管理から配布する）。
import { readFileSync, existsSync, statSync } from "node:fs";
import { zipPaths } from "./zipFolder";
import { verifyPackage } from "./verifyPackage";
import { verifyRawPackage } from "./verifyRawPackage";
import type { RawAppTask } from "./rawAppTask";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RegisterResult {
  taskId: string;
  artifacts: { sample_video: string; assets_zip: string };
}

// 就労者へ配る素材一式。完成見本.mp4 と内部JSON（素材一覧.json / app_task.json）は入れない。
const SUPPLIED = ["素材", "作業指示一覧.csv", "はじめに.txt"];

export function zipSuppliedAssets(pkgDir: string): string {
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

/** カット練習の案件の素材置き場。アプリはこの頭の文字で「自分で並べて切る案件」と見分ける（src/lib/tasks/taskMode.ts） */
export const RAW_STORAGE_PREFIX = "scene-raw";
const SUPPLIED_RAW = ["素材", "台本.txt", "はじめに.txt"];
const MAX_UPLOAD_MB = 50;

/**
 * カット練習の形のパッケージ（buildRawPackage.ts の出力）を案件として登録する。
 * 消す所の答え（編集ポイント.json）は受講者に配らず、検品のために素材置き場にだけ置く。
 */
export async function registerRawSceneTask(
  sb: SupabaseClient,
  opts: { pkgDir: string; staffId: string | null; difficulty: number },
): Promise<RegisterResult> {
  const { pkgDir, staffId, difficulty } = opts;
  const check = verifyRawPackage(pkgDir);
  console.log(`  関門OK: 収録 ${check.scenes}本・計${check.rawSec}秒 / 消す所 ${check.cuts}か所`);
  const P = JSON.parse(readFileSync(`${pkgDir}/app_task.json`, "utf8")) as RawAppTask;

  const taskId = randomUUID();
  const base = `${RAW_STORAGE_PREFIX}/${taskId}`;
  const zipFile = `${pkgDir}/支給素材一式.zip`;
  zipPaths(pkgDir, SUPPLIED_RAW, zipFile);
  // 素材置き場（Supabase 無料プラン）は1ファイル50MBまで。登録の途中で止まらないよう、先に確かめる
  const zipMb = statSync(zipFile).size / 1024 / 1024;
  if (zipMb > MAX_UPLOAD_MB) throw new Error(`支給素材のZIPが ${zipMb.toFixed(1)}MB あり、置き場の上限（${MAX_UPLOAD_MB}MB）をこえます。動画を短くしてください`);

  const t = await sb
    .from("tasks")
    .insert({
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
    })
    .select("id")
    .single();
  if (t.error) throw new Error("tasks insert: " + t.error.message);

  // 途中で失敗したら、素材の無い案件が公開されたまま残らないように消す
  try {
    await upload(sb, `${base}/sample.mp4`, `${pkgDir}/完成見本.mp4`, "video/mp4");
    await upload(sb, `${base}/assets.zip`, zipFile, "application/zip");
    await upload(sb, `${base}/edit_key.json`, `${pkgDir}/編集ポイント.json`, "application/json");

    const mats = [
      { kind: "request_doc", title: "お仕事の依頼書", content: P.requestDoc, media_url: null, sort_order: 0 },
      { kind: "script", title: "台本", content: P.script, media_url: null, sort_order: 1 },
      { kind: "sample", title: "完成見本", content: "仕上がりの一例です。カットやテロップの入れ方は、これと同じでなくてかまいません。", media_url: `${base}/sample.mp4`, sort_order: 3 },
      { kind: "source_assets", title: "支給素材一式（ダウンロード）", content: "録ったままの声・場面ごとの映像・BGM・効果音・台本が入ったZIPファイルです。「素材」フォルダをそのまま DaVinci に入れます。", media_url: `${base}/assets.zip`, sort_order: 4 },
      { kind: "revision_note", title: "納品前チェックリスト", content: JSON.stringify(P.checklist), media_url: null, sort_order: 9 },
    ].map((m) => ({
      ...m,
      steps: null,
      task_id: taskId,
      generated_by: "staff",
      is_approved: true,
      visible_before_submission: m.kind !== "sample",
    }));
    const mi = await sb.from("task_materials").insert(mats);
    if (mi.error) throw new Error("materials insert: " + mi.error.message);
  } catch (e) {
    await sb.from("task_materials").delete().eq("task_id", taskId);
    await sb.from("tasks").delete().eq("id", taskId);
    await sb.storage.from("materials").remove([`${base}/sample.mp4`, `${base}/assets.zip`, `${base}/edit_key.json`]);
    throw e;
  }

  return { taskId, artifacts: { sample_video: `${base}/sample.mp4`, assets_zip: `${base}/assets.zip` } };
}

/**
 * すでに登録してある案件の完成見本・支給素材・依頼書・作業指示一覧を、作り直したパッケージで置き換える。
 * 案件ID・割り当て・提出の記録はそのまま残す（作り方を直したあと、今ある案件にも反映するため）。
 */
export async function updateSceneTask(
  sb: SupabaseClient,
  opts: { pkgDir: string; taskId: string },
): Promise<RegisterResult> {
  const { pkgDir, taskId } = opts;
  const check = verifyPackage(pkgDir);
  console.log(`  関門OK: 並べた長さ ${check.totalFrames}f / 完成見本 ${check.sampleFrames}f / セリフ ${check.voices}本`);
  const P = JSON.parse(readFileSync(`${pkgDir}/app_task.json`, "utf8"));

  const { data: rows, error } = await sb
    .from("task_materials")
    .select("id, kind, title, media_url")
    .eq("task_id", taskId);
  if (error) throw new Error("materials select: " + error.message);
  const find = (kind: string, title?: string) =>
    (rows ?? []).find((r) => r.kind === kind && (title === undefined || r.title === title));
  const sample = find("sample");
  const assets = find("source_assets");
  if (!sample?.media_url || !assets?.media_url) throw new Error(`案件 ${taskId} に完成見本か支給素材がありません`);

  await upload(sb, sample.media_url, `${pkgDir}/完成見本.mp4`, "video/mp4");
  await upload(sb, assets.media_url, zipSuppliedAssets(pkgDir), "application/zip");

  const contents: [string, string, string][] = [
    ["request_doc", "お仕事の依頼書", P.requestDoc],
    ["revision_note", "作業指示一覧", P.timelineMd],
    ["revision_note", "納品前チェックリスト", JSON.stringify(P.checklist)],
  ];
  for (const [kind, title, content] of contents) {
    const row = find(kind, title);
    if (!row) throw new Error(`案件 ${taskId} に「${title}」がありません`);
    const u = await sb.from("task_materials").update({ content }).eq("id", row.id);
    if (u.error) throw new Error(`${title} update: ${u.error.message}`);
  }
  return { taskId, artifacts: { sample_video: sample.media_url, assets_zip: assets.media_url } };
}
