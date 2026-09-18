import { createAdminClient } from "@/lib/supabase/admin";
import { gradeSubmission } from "@/lib/ai";
import { autoReturnSummary, decideAutoReturn } from "./autoReturn";
import type { GradeResult } from "@/lib/ai";
import type { CheckResult, SelfCheckItem, TaskMaterial } from "@/lib/types";

export interface CreateAiReviewResult {
  feedbackId: string;
  /** 自動で利用者へ差し戻したか */
  autoReturned: boolean;
  /** 差し戻した理由（利用者にそのまま表示される文言） */
  reasons: string[];
  /** AI採点が動いたか。false なら職員が手で総評を書く必要がある */
  graded: boolean;
}

const GRADE_FAILED_SUMMARY =
  "AIの自動採点ができませんでした。職員が動画を見て結果をお伝えします。";

/**
 * 提出物に対するAIレビュー下書きを作り、必要なら自動で差し戻す。
 *
 * 重要: feedback / submission_inspections は「職員のみ」のRLSなので、
 * 就労者セッションのクライアントでは insert できない（42501で無言のまま消える）。
 * 提出直後の処理は就労者のセッションで走るため、ここでは必ず管理クライアントを使う。
 *
 * 失敗したら例外を投げる。呼び出し側は提出自体を失敗させずにログを残すこと
 * （提出物は /staff/reviews にAIレビュー未実施として必ず並ぶ）。
 */
export async function createAiReview(
  submissionId: string,
  options?: {
    /**
     * 呼び出し元が権限確認済みの割当ID。指定すると、提出物がその割当のもので
     * あることを確認してから処理する（就労者セッションから呼ぶ場合は必ず渡す）。
     */
    expectAssignmentId?: string;
  },
): Promise<CreateAiReviewResult> {
  const admin = createAdminClient();

  const { data: submission, error: subErr } = await admin
    .from("submissions")
    .select(
      "id, assignment_id, version, file_name, note, self_check, work_minutes, task_assignments(id, task_id, tasks(title, estimated_minutes))",
    )
    .eq("id", submissionId)
    .single();
  if (subErr || !submission) {
    throw new Error(`提出物が見つかりません (${submissionId}): ${subErr?.message ?? "no row"}`);
  }

  const assignment = submission.task_assignments as unknown as {
    id: string;
    task_id: string;
    tasks: { title: string; estimated_minutes: number | null } | null;
  } | null;
  if (!assignment) {
    throw new Error(`提出物 ${submissionId} に割当が紐づいていません`);
  }
  if (options?.expectAssignmentId && assignment.id !== options.expectAssignmentId) {
    throw new Error(
      `提出物 ${submissionId} は指定された割当のものではありません（他人の提出物へのアクセスを防ぐため中断）`,
    );
  }

  const selfCheck = (submission.self_check ?? []) as SelfCheckItem[];

  const [{ data: requestDocRow }, { data: inspection }] = await Promise.all([
    admin
      .from("task_materials")
      .select("content")
      .eq("task_id", assignment.task_id)
      .eq("kind", "request_doc")
      .limit(1)
      .maybeSingle<Pick<TaskMaterial, "content">>(),
    admin
      .from("submission_inspections")
      .select("status, check_result")
      .eq("submission_id", submissionId)
      .maybeSingle<{ status: string; check_result: CheckResult | null }>(),
  ]);

  // 検品が終わっている場合だけ、その結果を差し戻し判定に使う
  const checkResult =
    inspection?.status === "completed" ? (inspection.check_result ?? null) : null;

  let grade: GradeResult | null = null;
  try {
    grade = await gradeSubmission({
      taskTitle: assignment.tasks?.title ?? "",
      requestDoc: requestDocRow?.content ?? "",
      selfCheck,
      note: submission.note ?? null,
      workMinutes: submission.work_minutes ?? null,
      estimatedMinutes: assignment.tasks?.estimated_minutes ?? null,
      isResubmission: (submission.version ?? 1) > 1,
    });
  } catch (err) {
    // AIが落ちても下書き行は必ず作る（行が無いと職員の導線が消えるため）
    console.error("AI採点に失敗しました。職員確認待ちの下書きを作ります:", err);
  }

  const decision = decideAutoReturn({
    selfCheck,
    fileName: submission.file_name ?? null,
    checkResult,
  });

  // 同じ提出に対する未処理のAI下書きは破棄扱いにして、最新の下書き1件だけを残す
  const { error: supersedeErr } = await admin
    .from("feedback")
    .update({ status: "rejected" })
    .eq("submission_id", submissionId)
    .eq("source", "ai")
    .eq("status", "pending_review");
  if (supersedeErr) {
    throw new Error(`古いAI下書きの整理に失敗: ${supersedeErr.message}`);
  }

  const { data: inserted, error: insErr } = await admin
    .from("feedback")
    .insert({
      submission_id: submissionId,
      source: "ai",
      // 自動差し戻しは利用者へすぐ見せる必要があるため approved で入れる。
      // reviewed_by が null のままなので「職員未確認」として職員画面に残る。
      status: decision.shouldReturn ? "approved" : "pending_review",
      score: decision.shouldReturn ? null : (grade?.score ?? null),
      summary: decision.shouldReturn
        ? autoReturnSummary(decision.reasons.length)
        : (grade?.summary ?? GRADE_FAILED_SUMMARY),
      good_points: grade?.goodPoints ?? null,
      improve_points: [...decision.reasons, ...(grade?.improvePoints ?? [])],
      criteria: decision.shouldReturn ? null : (grade?.criteria ?? null),
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    throw new Error(`AIレビュー下書きの保存に失敗: ${insErr?.message ?? "no row"}`);
  }

  if (decision.shouldReturn) {
    const { error: asgErr } = await admin
      .from("task_assignments")
      .update({ status: "feedback" })
      .eq("id", assignment.id);
    if (asgErr) {
      throw new Error(`差し戻し状態への更新に失敗: ${asgErr.message}`);
    }
  }

  return {
    feedbackId: inserted.id as string,
    autoReturned: decision.shouldReturn,
    reasons: decision.reasons,
    graded: grade !== null,
  };
}
