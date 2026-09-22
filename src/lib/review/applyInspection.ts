import { createAdminClient } from "@/lib/supabase/admin";
import { autoReturnSummary, decideAutoReturn } from "./autoReturn";
import { createAiReview } from "./createAiReview";
import type { CheckResult, Feedback, FeedbackCriterion, SelfCheckItem } from "@/lib/types";

/**
 * 機械検品の完了結果を、提出物のAIレビュー下書きへ反映する。
 *
 * 提出直後の createAiReview は検品がまだ終わっていない（pending 行を作るだけ）ため、
 * 検品の fail が自動差し戻しに効かない。検品ワーカーが完了時にこの関数を呼び、
 * セルフチェック・拡張子・検品結果をそろえて差し戻し判定をやり直す。
 * AIのテキスト採点は再実行しない（入力が変わらないため）。
 */

export const MACHINE_CHECK_KEY = "machine_check";

const CHECK_STATUS_LABEL: Record<string, string> = { pass: "OK", fail: "NG", unknown: "不明" };

type ActiveFeedback = Pick<Feedback, "id" | "status" | "reviewed_by" | "improve_points" | "criteria">;

export interface MergedInspection {
  /** feedback 行に適用する更新内容 */
  patch: {
    status?: Feedback["status"];
    score?: number | null;
    summary?: string;
    improve_points?: string[];
    criteria: FeedbackCriterion[];
  };
  /** true なら割当を差し戻し状態(feedback)にする */
  returnToTrainee: boolean;
  reasons: string[];
}

/** 検品結果を「くわしい評価」の1項目に変換する */
export function machineCheckCriterion(checkResult: CheckResult): FeedbackCriterion {
  const comment = checkResult.checks
    .map(
      (c) =>
        `${c.label}: ${CHECK_STATUS_LABEL[c.status] ?? c.status}（実測: ${c.actual} / 見本: ${c.expected}）`,
    )
    .join(" / ");
  return {
    key: MACHINE_CHECK_KEY,
    label: "見本との自動照合",
    score: Math.max(0, Math.min(5, Math.round(checkResult.autoScore / 20))),
    comment,
  };
}

/**
 * 既存のAI下書きに検品結果を合成する（純関数）。
 *
 * - 差し戻し理由が出たら: 利用者へ即公開（approved, reviewed_by は null のまま）し、
 *   理由を「直してほしいこと」の先頭に置く。AIのテキスト採点で出ていた改善点は後ろに残す。
 * - 理由が無ければ: 「くわしい評価」に照合結果を足すだけ（職員の承認待ちのまま）。
 */
export function mergeInspectionIntoFeedback(
  feedback: ActiveFeedback,
  input: { selfCheck: SelfCheckItem[]; fileName: string | null; checkResult: CheckResult },
): MergedInspection {
  const decision = decideAutoReturn(input);
  const criteria = [
    ...(feedback.criteria ?? []).filter((c) => c.key !== MACHINE_CHECK_KEY),
    machineCheckCriterion(input.checkResult),
  ];

  if (!decision.shouldReturn) {
    return { patch: { criteria }, returnToTrainee: false, reasons: [] };
  }

  const reasonSet = new Set(decision.reasons);
  const aiPoints = (feedback.improve_points ?? []).filter((p) => !reasonSet.has(p));
  return {
    patch: {
      status: "approved",
      score: null,
      summary: autoReturnSummary(decision.reasons.length),
      improve_points: [...decision.reasons, ...aiPoints],
      criteria,
    },
    returnToTrainee: true,
    reasons: decision.reasons,
  };
}

export interface ApplyInspectionResult {
  applied: boolean;
  autoReturned: boolean;
  reasons: string[];
  /** 反映しなかった／別経路で処理した理由（ログ用） */
  note: string | null;
}

/** 検品完了後に呼ぶ。提出物のAI下書きへ結果を反映し、必要なら自動で差し戻す */
export async function applyInspectionResult(
  submissionId: string,
  checkResult: CheckResult,
): Promise<ApplyInspectionResult> {
  const admin = createAdminClient();

  const { data: submission, error: subErr } = await admin
    .from("submissions")
    .select("id, assignment_id, version, file_name, self_check, task_assignments(id, status)")
    .eq("id", submissionId)
    .single();
  if (subErr || !submission) {
    throw new Error(`提出物が見つかりません (${submissionId}): ${subErr?.message ?? "no row"}`);
  }
  const assignment = submission.task_assignments as unknown as { id: string; status: string } | null;

  // 検品には数分かかるため、その間に利用者が再提出していることがある。
  // 古い提出の結果で割当を差し戻しに戻すと、直した後の提出が無視されて見えるので反映しない。
  const { data: newer, error: newerErr } = await admin
    .from("submissions")
    .select("id")
    .eq("assignment_id", submission.assignment_id)
    .gt("version", submission.version ?? 1)
    .limit(1)
    .maybeSingle();
  if (newerErr) throw new Error(`最新の提出の確認に失敗: ${newerErr.message}`);
  if (newer) {
    return { applied: false, autoReturned: false, reasons: [], note: "新しい提出があるため反映しない" };
  }

  const { data: feedbackRows, error: fbErr } = await admin
    .from("feedback")
    .select("id, status, reviewed_by, improve_points, criteria, created_at, source")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });
  if (fbErr) throw new Error(`feedback の取得に失敗: ${fbErr.message}`);
  const feedbacks = (feedbackRows ?? []) as Array<ActiveFeedback & { source: string }>;

  // 職員が合格／差し戻しを確定済みなら、その判断を上書きしない
  if (feedbacks.some((f) => f.status === "approved" && f.reviewed_by !== null)) {
    return { applied: false, autoReturned: false, reasons: [], note: "職員が確定済みのため反映しない" };
  }

  const active =
    feedbacks.find((f) => f.source === "ai" && f.status === "pending_review") ??
    feedbacks.find((f) => f.source === "ai" && f.status === "approved" && f.reviewed_by === null) ??
    null;

  // 下書きが無い（提出時に失敗した）場合は、検品結果込みで下書きを作り直す
  if (!active) {
    // 検品ジョブはまだ「処理中」で DB から結果を読めないため、結果を直接渡す
    const created = await createAiReview(submissionId, { checkResult });
    return {
      applied: true,
      autoReturned: created.autoReturned,
      reasons: created.reasons,
      note: "AI下書きが無かったため createAiReview で作成",
    };
  }

  const merged = mergeInspectionIntoFeedback(active, {
    selfCheck: (submission.self_check ?? []) as SelfCheckItem[],
    fileName: submission.file_name ?? null,
    checkResult,
  });

  const { error: updErr } = await admin.from("feedback").update(merged.patch).eq("id", active.id);
  if (updErr) throw new Error(`feedback の更新に失敗: ${updErr.message}`);

  if (merged.returnToTrainee && assignment && assignment.status !== "completed") {
    const { error: asgErr } = await admin
      .from("task_assignments")
      .update({ status: "feedback" })
      .eq("id", assignment.id);
    if (asgErr) throw new Error(`差し戻し状態への更新に失敗: ${asgErr.message}`);
  }

  return { applied: true, autoReturned: merged.returnToTrainee, reasons: merged.reasons, note: null };
}
