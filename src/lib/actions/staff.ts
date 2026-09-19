"use server";

import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import { createAiReview } from "@/lib/review/createAiReview";
import type { AptitudeKey } from "@/lib/types";
import type { ActionState } from "./assignments";

/** 教材を承認（利用者に表示されるようになる） */
export async function approveMaterial(materialId: string, taskId: string) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  await supabase
    .from("task_materials")
    .update({ is_approved: true })
    .eq("id", materialId);
  revalidatePath(`/staff/tasks/${taskId}`);
}

/** 完成見本の公開範囲を切り替え（提出前から公開 / 職員のみ→提出後に公開） */
export async function setSampleVisibility(
  materialId: string,
  taskId: string,
  visibleBeforeSubmission: boolean,
) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_materials")
    .update({ visible_before_submission: visibleBeforeSubmission })
    .eq("id", materialId);
  if (error) {
    throw new Error(`完成見本の公開範囲を変更できませんでした: ${error.message}`);
  }
  revalidatePath(`/staff/tasks/${taskId}`);
}

/** 課題を公開 */
export async function publishTask(taskId: string) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  await supabase.from("tasks").update({ status: "published" }).eq("id", taskId);
  revalidatePath(`/staff/tasks/${taskId}`);
  revalidatePath("/staff");
}

/** 利用者に課題を割り当て */
export async function assignTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const taskId = String(formData.get("task_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const dueDays = Number(formData.get("due_days") ?? 3);

  if (!taskId || !userId) return { error: "割り当て先を選んでください。" };

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + dueDays);

  const { error } = await supabase.from("task_assignments").insert({
    task_id: taskId,
    user_id: userId,
    status: "not_started",
    due_at: dueAt.toISOString(),
    assigned_by: staff.id,
  });
  if (error) {
    return { error: "割り当てに失敗しました（すでに割り当て済みの可能性があります）。" };
  }
  revalidatePath(`/staff/tasks/${taskId}`);
  return { error: null, success: true };
}

/** AIフィードバックを承認/編集して利用者に公開 */
export type ReviewDecision = "complete" | "revise" | "discard";

const REVIEW_DECISIONS: ReviewDecision[] = ["complete", "revise", "discard"];

/**
 * 提出物のレビューを確定する。
 * - complete: 合格。利用者に公開して案件を完了にする
 * - revise  : 差し戻し。利用者に公開して「やり直して再提出」の状態にする
 * - discard : AI下書きを破棄。提出物は未レビューとして /staff/reviews に残る
 *
 * AI下書きが無い提出物（feedback_id なし）でも、職員が自分で結果を書いて
 * 確定できる。これが無いと、AIレビューが作られなかった提出物が詰む。
 */
export async function submitReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const feedbackId = String(formData.get("feedback_id") ?? "") || null;
  const submissionId = String(formData.get("submission_id") ?? "") || null;
  const assignmentId = String(formData.get("assignment_id") ?? "");
  const decision = String(formData.get("decision") ?? "") as ReviewDecision;
  const summary = String(formData.get("summary") ?? "").trim();
  const score = Number(formData.get("score") ?? 0);
  const improvePoints = String(formData.get("improve_points") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!REVIEW_DECISIONS.includes(decision)) {
    return { error: "操作を選んでください。" };
  }
  if (decision === "revise" && improvePoints.length === 0) {
    return { error: "差し戻すときは、直してほしいことを1つ以上書いてください。" };
  }

  if (decision === "discard") {
    if (!feedbackId) return { error: "破棄する下書きがありません。" };
    const { error } = await supabase
      .from("feedback")
      .update({
        status: "rejected",
        reviewed_by: staff.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", feedbackId);
    if (error) return { error: "更新に失敗しました。" };
    revalidatePath("/staff/reviews");
    revalidatePath("/staff");
    return { error: null, success: true };
  }

  // score は 0-100 の CHECK 制約付き。範囲外は保存せず null にする
  const validScore =
    Number.isFinite(score) && score > 0 && score <= 100 ? Math.round(score) : null;
  const reviewed = {
    status: "approved" as const,
    summary: summary || null,
    score: validScore,
    improve_points: improvePoints,
    reviewed_by: staff.id,
    reviewed_at: new Date().toISOString(),
  };

  if (feedbackId) {
    const { error } = await supabase
      .from("feedback")
      .update(reviewed)
      .eq("id", feedbackId);
    if (error) return { error: "更新に失敗しました。" };
  } else {
    if (!submissionId) return { error: "対象が見つかりません。" };
    const { error } = await supabase.from("feedback").insert({
      ...reviewed,
      submission_id: submissionId,
      source: "staff",
    });
    if (error) return { error: "保存に失敗しました。" };
  }

  if (assignmentId) {
    const completed = decision === "complete";
    const { error: asgErr } = await supabase
      .from("task_assignments")
      .update({
        status: completed ? "completed" : "feedback",
        ...(completed ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", assignmentId);
    if (asgErr) return { error: "案件の状態を更新できませんでした。" };
  }

  revalidatePath("/staff/reviews");
  revalidatePath("/staff");
  return { error: null, success: true };
}

/**
 * 提出物に対してAIレビューを実行（または再実行）する。
 * 提出時にAIレビューが作られなかった提出物を、職員が手動で立ち上げ直すための導線。
 */
export async function runAiReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("staff", "admin");

  const submissionId = String(formData.get("submission_id") ?? "");
  if (!submissionId) return { error: "対象が見つかりません。" };

  try {
    await createAiReview(submissionId);
  } catch (err) {
    console.error("AIレビューの手動実行に失敗しました:", err);
    return {
      error:
        "AIレビューを実行できませんでした。時間をおいて、もう一度試してください。",
    };
  }

  revalidatePath("/staff/reviews");
  revalidatePath("/staff");
  return { error: null, success: true };
}

/** 適性・特性を記録 */
export async function recordAptitude(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const userId = String(formData.get("user_id") ?? "");
  const key = String(formData.get("key") ?? "") as AptitudeKey;
  const rating = Number(formData.get("rating") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!userId || !key || rating < 1 || rating > 5) {
    return { error: "評価項目と評価（1〜5）を選んでください。" };
  }

  const { error } = await supabase.from("user_aptitudes").insert({
    user_id: userId,
    key,
    rating,
    note,
    recorded_by: staff.id,
  });
  if (error) return { error: "記録に失敗しました。" };

  revalidatePath(`/staff/users/${userId}`);
  return { error: null, success: true };
}

/** 本番移行の承認を記録（承認 or 取り消し。追記型で履歴を残す） */
export async function recordTransferApproval(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const userId = String(formData.get("user_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!userId || (decision !== "approved" && decision !== "revoked")) {
    return { error: "承認内容が不正です。" };
  }

  const { error } = await supabase
    .from("production_transfer_approvals")
    .insert({ user_id: userId, decision, note, approved_by: staff.id });
  if (error) {
    return {
      error:
        "承認の記録に失敗しました（migration 00010_production_transfer_approvals.sql が未適用の可能性があります）。",
    };
  }

  revalidatePath(`/staff/users/${userId}`);
  return { error: null, success: true };
}

/** 利用者のアクセシビリティ設定を更新（職員 or 本人） */
export async function updateAccessibilitySettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole("trainee", "staff", "admin");
  const supabase = await createClient();

  const targetId = String(formData.get("user_id") ?? profile.id);
  if (targetId !== profile.id && profile.role === "trainee") {
    return { error: "権限がありません。" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      step_mode_enabled: formData.get("step_mode_enabled") === "on",
      large_text_enabled: formData.get("large_text_enabled") === "on",
      read_aloud_enabled: formData.get("read_aloud_enabled") === "on",
      break_interval_minutes: Math.min(
        180,
        Math.max(10, Number(formData.get("break_interval_minutes") ?? 50)),
      ),
    })
    .eq("id", targetId);
  if (error) return { error: "設定の保存に失敗しました。" };

  revalidatePath("/settings");
  revalidatePath("/home");
  return { error: null, success: true };
}
