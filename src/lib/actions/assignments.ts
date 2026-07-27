"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeSubmission } from "@/lib/ai";
import type { ProgressEvent, SelfCheckItem, TaskMaterial } from "@/lib/types";

export interface ActionState {
  error: string | null;
  success?: boolean;
}

/** 作業開始・休憩などの進捗イベントを記録 */
export async function logProgress(
  assignmentId: string,
  event: ProgressEvent,
  options?: { progressPercent?: number; minutesDelta?: number; note?: string },
): Promise<ActionState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("progress_logs").insert({
    assignment_id: assignmentId,
    user_id: profile.id,
    event,
    progress_percent: options?.progressPercent ?? null,
    minutes_delta: options?.minutesDelta ?? null,
    note: options?.note ?? null,
  });
  if (error) return { error: "記録に失敗しました。もう一度試してください。" };

  // 初回開始時にステータスを更新
  if (event === "start") {
    await supabase
      .from("task_assignments")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("status", "not_started");
  }

  revalidatePath(`/tasks/${assignmentId}`);
  return { error: null, success: true };
}

/** 提出 + AI採点（結果は職員承認待ちとして保存） */
export async function submitWork(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const assignmentId = String(formData.get("assignment_id") ?? "");
  const filePath = String(formData.get("file_path") ?? "") || null;
  const fileName = String(formData.get("file_name") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const workMinutes = Number(formData.get("work_minutes") ?? 0) || null;

  let selfCheck: SelfCheckItem[] = [];
  try {
    selfCheck = JSON.parse(String(formData.get("self_check") ?? "[]"));
  } catch {
    selfCheck = [];
  }

  if (!assignmentId) return { error: "提出先の課題が見つかりません。" };
  if (!filePath) return { error: "ファイルをアップロードしてください。" };

  // 割当の所有確認 + 課題情報取得
  const { data: assignment, error: aErr } = await supabase
    .from("task_assignments")
    .select("id, user_id, task_id, tasks(title, estimated_minutes)")
    .eq("id", assignmentId)
    .eq("user_id", profile.id)
    .single();
  if (aErr || !assignment) return { error: "課題が見つかりません。" };

  // 提出バージョン
  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);
  const version = (count ?? 0) + 1;

  const { data: submission, error: sErr } = await supabase
    .from("submissions")
    .insert({
      assignment_id: assignmentId,
      version,
      file_path: filePath,
      file_name: fileName,
      note,
      self_check: selfCheck,
      work_minutes: workMinutes,
    })
    .select("id")
    .single();
  if (sErr || !submission) {
    return { error: "提出に失敗しました。もう一度試してください。" };
  }

  await supabase
    .from("task_assignments")
    .update({ status: "submitted" })
    .eq("id", assignmentId);

  await supabase.from("progress_logs").insert({
    assignment_id: assignmentId,
    user_id: profile.id,
    event: "submit",
    progress_percent: 100,
    minutes_delta: workMinutes,
  });

  // AI採点（失敗しても提出自体は成立させる）
  try {
    const task = assignment.tasks as unknown as {
      title: string;
      estimated_minutes: number | null;
    };
    const { data: requestDocRow } = await supabase
      .from("task_materials")
      .select("content")
      .eq("task_id", assignment.task_id)
      .eq("kind", "request_doc")
      .limit(1)
      .maybeSingle<Pick<TaskMaterial, "content">>();

    const result = await gradeSubmission({
      taskTitle: task.title,
      requestDoc: requestDocRow?.content ?? "",
      selfCheck,
      note,
      workMinutes,
      estimatedMinutes: task.estimated_minutes,
      isResubmission: version > 1,
    });

    await supabase.from("feedback").insert({
      submission_id: submission.id,
      source: "ai",
      status: "pending_review",
      score: result.score,
      summary: result.summary,
      good_points: result.goodPoints,
      improve_points: result.improvePoints,
      criteria: result.criteria,
    });
  } catch (err) {
    console.error("AI採点に失敗しました（提出は完了しています）:", err);
  }

  // 機械検品ジョブ登録（AI動画生成パイプラインの案件で正解データがある場合のみ。
  // video_jobs未適用/該当なしなら何もしない。実処理は scripts/video/inspect-worker.ts が行う）
  // video_jobs / submission_inspections は職員のみRLSのため、就労者セッションの
  // createClient() では読み書きできない。管理クライアントで最小限の範囲だけ操作する。
  try {
    const admin = createAdminClient();
    const { data: videoJob, error: vjErr } = await admin
      .from("video_jobs")
      .select("id")
      .eq("task_id", assignment.task_id)
      .not("answer_data", "is", null)
      .limit(1)
      .maybeSingle();
    if (vjErr) throw vjErr;

    if (videoJob) {
      const { error: insErr } = await admin.from("submission_inspections").insert({
        submission_id: submission.id,
        status: "pending",
      });
      if (insErr) throw insErr;
    }
  } catch (err) {
    console.error("機械検品ジョブの登録に失敗しました（提出は完了しています）:", err);
  }

  revalidatePath(`/tasks/${assignmentId}`);
  revalidatePath("/home");
  return { error: null, success: true };
}

/** 職員への質問を送信 */
export async function askQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const question = String(formData.get("question") ?? "").trim();
  const assignmentId = String(formData.get("assignment_id") ?? "") || null;

  if (!question) return { error: "質問を入力してください。" };

  const { error } = await supabase.from("qa_logs").insert({
    user_id: profile.id,
    assignment_id: assignmentId,
    question,
    needs_staff: true,
  });
  if (error) return { error: "送信に失敗しました。もう一度試してください。" };

  if (assignmentId) {
    await supabase.from("progress_logs").insert({
      assignment_id: assignmentId,
      user_id: profile.id,
      event: "consult",
      note: question.slice(0, 100),
    });
    revalidatePath(`/tasks/${assignmentId}`);
  }
  return { error: null, success: true };
}
