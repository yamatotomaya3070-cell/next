"use server";

import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import type { ActionState } from "./assignments";

/**
 * SCENE動画案件の生成ジョブを「登録」するだけのアクション（pending 行の作成）。
 * 実際の生成（設計図→完成見本→素材→手順書→案件登録）は ffmpeg/sharp/Gemini の
 * 使えるローカルワーカー（scripts/scene/worker.ts）が別途実行する。
 * この Next.js サーバー（Vercel想定）では重い生成は行わない。
 */
export async function createSceneJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const theme = String(formData.get("theme") ?? "").trim();
  const audience = String(formData.get("audience") ?? "投資初心者").trim() || "投資初心者";
  const targetMinutes = Number(formData.get("target_minutes") ?? 6);
  const difficulty = Number(formData.get("difficulty") ?? 3);

  if (!theme) {
    return { error: "テーマを入力してください。" };
  }
  if (!Number.isFinite(targetMinutes) || targetMinutes < 3 || targetMinutes > 15) {
    return { error: "目標の長さは3〜15分で指定してください。" };
  }
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
    return { error: "難易度は1〜5で指定してください。" };
  }

  const { error } = await supabase.from("scene_jobs").insert({
    theme,
    audience,
    target_minutes: targetMinutes,
    difficulty,
    status: "pending",
    created_by: staff.id,
  });

  if (error) {
    return { error: `ジョブの登録に失敗しました：${error.message}` };
  }

  revalidatePath("/staff/scene");
  return { error: null, success: true };
}

/**
 * 生成ナレッジ（動画・仕様書の不備／発音の指摘）を追加する。
 * 次回以降の YouTube動画生成 の台本プロンプトと音声合成に自動で注入される。
 */
export async function addSceneNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const note = String(formData.get("note") ?? "").trim();
  const term = String(formData.get("term") ?? "").trim();
  const reading = String(formData.get("reading") ?? "").trim();

  if (!note && !(term && reading)) {
    return { error: "メモ、または「言葉＋読み」を入力してください。" };
  }
  const finalNote = note || `「${term}」は「${reading}」と読む`;

  const { error } = await supabase.from("scene_generation_notes").insert({
    note: finalNote,
    term: term || null,
    reading: reading || null,
    created_by: staff.id,
  });
  if (error) {
    return { error: `メモの保存に失敗しました：${error.message}` };
  }

  revalidatePath("/staff/scene");
  return { error: null, success: true };
}
