"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, createClient } from "@/lib/supabase/server";
import { generateTask } from "@/lib/ai";
import { createAiReview } from "@/lib/review/createAiReview";
import type { AptitudeKey } from "@/lib/types";
import type { ActionState } from "./assignments";
import { buildManualGuidelinesContext } from "./manualSteps";

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

  if (!theme) return { error: "案件のテーマを入力してください。" };
  if (skillTags.length === 0) {
    return { error: "練習するスキルを1つ以上選んでください。" };
  }

  // 蓄積済みの実案件ナレッジを参考情報としてプロンプトに注入する。
  // 選択スキルと重なるものを優先し、テーブル未適用・0件でも生成は続行する。
  let knowledgeContext: string | undefined;
  try {
    const { data: matched } = await supabase
      .from("case_knowledge")
      .select("title, genre, difficulty, caution_points, masked_case_text")
      .overlaps("skill_tags", skillTags)
      .order("created_at", { ascending: false })
      .limit(5);
    let rows = matched ?? [];
    if (rows.length === 0) {
      const { data: recent } = await supabase
        .from("case_knowledge")
        .select("title, genre, difficulty, caution_points, masked_case_text")
        .order("created_at", { ascending: false })
        .limit(3);
      rows = recent ?? [];
    }
    if (rows.length > 0) {
      knowledgeContext = rows
        .map(
          (k, i) =>
            `${i + 1}. [${k.genre ?? "ジャンル不明"} / 難易度${k.difficulty ?? "?"}] ${k.title}\n` +
            `   概要: ${String(k.masked_case_text ?? "").slice(0, 300)}\n` +
            `   注意事項: ${(k.caution_points ?? []).join(" / ") || "（記録なし）"}`,
        )
        .join("\n");
    }
  } catch (err) {
    console.error("実案件ナレッジの取得に失敗（ナレッジなしで生成を続行）:", err);
  }

  // 過去の手順修正から学習したルール（なぜ直したか付き）を生成プロンプトに注入する。
  // これにより「完成見本を見せる手順を書かない」等の学習が以後の生成に自動反映される。
  const manualGuidelinesContext = await buildManualGuidelinesContext(
    supabase,
    skillTags,
  );

  let generated;
  try {
    generated = await generateTask({
      theme,
      difficulty,
      skillTags,
      traineeNote: traineeNote || undefined,
      knowledgeContext,
      manualGuidelinesContext: manualGuidelinesContext || undefined,
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

/** 完成見本の公開範囲を切り替え（提出前から公開 / 職員のみ→提出後に公開） */
export async function setSampleVisibility(
  materialId: string,
  taskId: string,
  visibleBeforeSubmission: boolean,
) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  await supabase
    .from("task_materials")
    .update({ visible_before_submission: visibleBeforeSubmission })
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
  revalidatePath("/staff/messages");
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
