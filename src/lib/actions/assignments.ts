"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAiReview } from "@/lib/review/createAiReview";
import { parseSelfCheck } from "@/lib/review/parseSelfCheck";
import { describeMessagesError } from "@/lib/messages/errors";
import type { ProgressEvent } from "@/lib/types";

export interface ActionState {
  error: string | null;
  success?: boolean;
}

/** 同じ案件を連続で提出できない間隔（連打と二重送信の防止） */
const RESUBMIT_COOLDOWN_MS = 60 * 1000;

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

/** 提出 + AIレビュー（明確なNGは自動で差し戻し、それ以外は職員承認待ちとして保存） */
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

  const selfCheck = parseSelfCheck(String(formData.get("self_check") ?? "[]"));

  if (!assignmentId) return { error: "提出先の課題が見つかりません。" };
  if (!filePath) return { error: "ファイルをアップロードしてください。" };

  // 割当の所有確認（課題名・依頼書は createAiReview 側で取得する）
  const { data: assignment, error: aErr } = await supabase
    .from("task_assignments")
    .select("id, user_id, task_id")
    .eq("id", assignmentId)
    .eq("user_id", profile.id)
    .single();
  if (aErr || !assignment) return { error: "課題が見つかりません。" };

  // 提出バージョン（件数ではなく最大versionから採る。過去の提出が消えても番号が衝突しない）
  const { data: previous } = await supabase
    .from("submissions")
    .select("version, submitted_at")
    .eq("assignment_id", assignmentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number; submitted_at: string }>();
  const version = (previous?.version ?? 0) + 1;

  // 連打・二重送信の防止。1回の提出ごとにAI採点（外部API）が走るため、
  // 短時間の再提出は受け付けない。
  if (
    previous &&
    Date.now() - new Date(previous.submitted_at).getTime() < RESUBMIT_COOLDOWN_MS
  ) {
    return {
      error:
        "さきほど提出したばかりです。1分ほど待ってから、もう一度提出してください。",
    };
  }

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

  // 機械検品ジョブ登録（AI動画生成パイプラインの案件で正解データがある場合のみ。
  // 該当なしなら何もしない。実処理は scripts/video/inspect-worker.ts が行う）
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
    } else {
      // SCENE系案件など、正解データが video_jobs に無い案件は見本との自動照合ができない。
      // 職員が /staff/reviews で目視レビューする運用になるため、無言で飛ばさずに記録する。
      console.info(
        `[submit] 正解データ(video_jobs.answer_data)が無いため機械検品をスキップ: task=${assignment.task_id}`,
      );
    }
  } catch (err) {
    console.error("機械検品ジョブの登録に失敗しました（提出は完了しています）:", err);
  }

  // AIレビュー下書きの作成＋明確なNGの自動差し戻し。
  // 失敗しても提出自体は成立させる（提出物は /staff/reviews に
  // 「AIレビュー未実施」として必ず並び、職員が手動で再実行できる）。
  try {
    await createAiReview(submission.id, { expectAssignmentId: assignmentId });
  } catch (err) {
    console.error("AIレビューの作成に失敗しました（提出は完了しています）:", err);
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

  // 質問は職員とのトーク（messages）に1発言として入る。返事も同じトークに届く
  const { error } = await supabase.from("messages").insert({
    trainee_id: profile.id,
    sender_id: profile.id,
    sender_kind: "trainee",
    sender_name: profile.display_name,
    assignment_id: assignmentId,
    body: question,
  });
  if (error) return { error: describeMessagesError(error) };

  if (assignmentId) {
    await supabase.from("progress_logs").insert({
      assignment_id: assignmentId,
      user_id: profile.id,
      event: "consult",
      note: question.slice(0, 100),
    });
    revalidatePath(`/tasks/${assignmentId}`);
  }
  revalidatePath("/messages");
  revalidatePath("/staff/messages");
  revalidatePath("/staff");
  return { error: null, success: true };
}
