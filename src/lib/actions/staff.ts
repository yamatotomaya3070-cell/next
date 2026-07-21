"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, createClient } from "@/lib/supabase/server";
import { generateTask } from "@/lib/ai";
import type { AptitudeKey } from "@/lib/types";
import type { ActionState } from "./assignments";

/** AIで練習課題一式を生成し、下書きとして保存 */
export async function createTaskWithAi(
  _prev: ActionState & { taskId?: string },
  formData: FormData,
): Promise<ActionState & { taskId?: string }> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const theme = String(formData.get("theme") ?? "").trim();
  const difficulty = Number(formData.get("difficulty") ?? 1);
  const skillTags = formData.getAll("skill_tags").map(String);
  const traineeNote = String(formData.get("trainee_note") ?? "").trim();

  if (!theme) return { error: "課題のテーマを入力してください。" };
  if (skillTags.length === 0) {
    return { error: "練習するスキルを1つ以上選んでください。" };
  }

  let generated;
  try {
    generated = await generateTask({
      theme,
      difficulty,
      skillTags,
      traineeNote: traineeNote || undefined,
    });
  } catch (err) {
    console.error("教材生成に失敗:", err);
    return { error: "AIによる教材生成に失敗しました。もう一度試してください。" };
  }

  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .insert({
      type: "practice",
      status: "draft",
      title: generated.title,
      summary: generated.summary,
      difficulty,
      skill_tags: skillTags,
      estimated_minutes: generated.estimatedMinutes,
      due_in_days: generated.dueInDays,
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (tErr || !task) return { error: "課題の保存に失敗しました。" };

  const materials = [
    {
      task_id: task.id,
      kind: "request_doc",
      title: "お仕事の依頼書（練習用）",
      content: generated.requestDoc,
      sort_order: 0,
      generated_by: "ai",
      is_approved: false,
    },
    {
      task_id: task.id,
      kind: "manual",
      title: "作業のやり方（手順書）",
      steps: generated.manualSteps,
      sort_order: 1,
      generated_by: "ai",
      is_approved: false,
    },
    ...(generated.script
      ? [
          {
            task_id: task.id,
            kind: "script" as const,
            title: "字幕用の台本",
            content: generated.script,
            sort_order: 2,
            generated_by: "ai" as const,
            is_approved: false,
          },
        ]
      : []),
    {
      task_id: task.id,
      kind: "revision_note",
      title: "納品前チェックリスト",
      content: JSON.stringify(generated.selfCheckItems),
      sort_order: 9,
      generated_by: "ai",
      is_approved: false,
    },
  ];

  const { error: mErr } = await supabase.from("task_materials").insert(materials);
  if (mErr) return { error: "教材の保存に失敗しました。" };

  revalidatePath("/staff");
  redirect(`/staff/tasks/${task.id}`);
}

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
export async function reviewFeedback(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const feedbackId = String(formData.get("feedback_id") ?? "");
  const assignmentId = String(formData.get("assignment_id") ?? "");
  const decision = String(formData.get("decision") ?? "approve");
  const summary = String(formData.get("summary") ?? "").trim();
  const score = Number(formData.get("score") ?? 0);
  const markCompleted = formData.get("mark_completed") === "on";

  if (!feedbackId) return { error: "対象が見つかりません。" };

  const { error } = await supabase
    .from("feedback")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      summary: summary || undefined,
      score: Number.isFinite(score) && score > 0 ? score : undefined,
      reviewed_by: staff.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);
  if (error) return { error: "更新に失敗しました。" };

  if (decision === "approve" && assignmentId) {
    await supabase
      .from("task_assignments")
      .update({
        status: markCompleted ? "completed" : "feedback",
        ...(markCompleted ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", assignmentId);
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

/** 質問に回答 */
export async function answerQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const qaId = String(formData.get("qa_id") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  if (!qaId || !answer) return { error: "回答を入力してください。" };

  const { error } = await supabase
    .from("qa_logs")
    .update({
      answer,
      answered_by: "staff",
      needs_staff: false,
      answered_at: new Date().toISOString(),
    })
    .eq("id", qaId);
  if (error) return { error: "回答の保存に失敗しました。" };

  revalidatePath("/staff");
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
      furigana_enabled: formData.get("furigana_enabled") === "on",
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
