import type { Feedback } from "@/lib/types";

/**
 * 提出物1件について、職員の対応がどこまで進んでいるか。
 *
 * - not_reviewed : AIレビューの下書きが無い（提出時に失敗した／破棄された）
 * - draft_pending: AI下書きがあり、職員の承認待ち
 * - auto_returned: AIが自動で利用者へ差し戻した。職員はまだ確認していない
 * - null         : 職員が合格／差し戻しを確定済み（対応不要）
 */
export type ReviewState = "not_reviewed" | "draft_pending" | "auto_returned";

/** 自動差し戻し（利用者には公開済み・職員は未確認） */
function isAutoReturned(f: Feedback): boolean {
  return f.status === "approved" && f.reviewed_by === null;
}

/** 職員が確定させたレビュー */
function isConfirmedByStaff(f: Feedback): boolean {
  return f.status === "approved" && f.reviewed_by !== null;
}

/** 提出物1件の対応状態。null なら職員の対応は完了している */
export function reviewStateOf(feedbacks: Feedback[]): ReviewState | null {
  if (feedbacks.some(isConfirmedByStaff)) return null;
  if (feedbacks.some(isAutoReturned)) return "auto_returned";
  if (feedbacks.some((f) => f.status === "pending_review")) return "draft_pending";
  return "not_reviewed";
}

/** 画面に出す対象のフィードバック（未処理のもの。無ければ null） */
export function activeFeedback(feedbacks: Feedback[]): Feedback | null {
  return (
    feedbacks.find((f) => f.status === "pending_review") ??
    feedbacks.find(isAutoReturned) ??
    null
  );
}

/**
 * 割当ごとの「最新の提出物」だけを残す。
 * 再提出されたら、古いバージョンはレビュー対象でも件数の対象でもない。
 */
export function latestSubmissionPerAssignment<
  T extends { assignment_id: string; version: number },
>(submissions: T[]): T[] {
  const latest = new Map<string, T>();
  for (const sub of submissions) {
    const current = latest.get(sub.assignment_id);
    if (!current || sub.version > current.version) {
      latest.set(sub.assignment_id, sub);
    }
  }
  return [...latest.values()];
}
