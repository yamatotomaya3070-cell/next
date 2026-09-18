"use client";

import { useActionState } from "react";
import { submitReview } from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/assignments";

interface ReviewFormProps {
  /** AI下書きが無い提出物では null（職員が自分で結果を書く） */
  feedbackId: string | null;
  submissionId: string;
  assignmentId: string;
  defaultScore: number;
  defaultSummary: string;
  defaultImprovePoints: string[];
  /** AIがすでに自動差し戻し済みの提出物か */
  autoReturned: boolean;
}

const initialState: ActionState = { error: null };

export function ReviewForm({
  feedbackId,
  submissionId,
  assignmentId,
  defaultScore,
  defaultSummary,
  defaultImprovePoints,
  autoReturned,
}: ReviewFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitReview,
    initialState,
  );

  if (state.success) {
    return <p className="font-bold text-success">処理しました ✅</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      {feedbackId && <input type="hidden" name="feedback_id" value={feedbackId} />}
      <input type="hidden" name="submission_id" value={submissionId} />
      <input type="hidden" name="assignment_id" value={assignmentId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-bold text-ink-soft">スコア</span>
          <input
            type="number"
            name="score"
            min={0}
            max={100}
            defaultValue={defaultScore}
            className="mt-1 block w-24 rounded-xl border-2 border-line px-3 py-2"
          />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-bold text-ink-soft">
            総評（利用者に表示。編集可）
          </span>
          <textarea
            name="summary"
            rows={2}
            defaultValue={defaultSummary}
            className="mt-1 block w-full rounded-xl border-2 border-line px-3 py-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-bold text-ink-soft">
          直してほしいこと（1行に1つ・差し戻すときは必須）
        </span>
        <textarea
          name="improve_points"
          rows={3}
          defaultValue={defaultImprovePoints.join("\n")}
          placeholder={"例: S3の字幕が1つ抜けています\n例: BGMの音量が大きすぎます"}
          className="mt-1 block w-full rounded-xl border-2 border-line px-3 py-2"
        />
      </label>

      {state.error && (
        <p role="alert" className="font-bold text-danger">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="decision"
          value="complete"
          disabled={isPending}
          className="rounded-xl bg-success px-5 py-2 font-bold text-white transition hover:bg-success/90 disabled:opacity-50"
        >
          合格にする（完了）
        </button>
        <button
          type="submit"
          name="decision"
          value="revise"
          disabled={isPending}
          className="rounded-xl bg-accent-purple px-5 py-2 font-bold text-white transition hover:bg-accent-purple/90 disabled:opacity-50"
        >
          {autoReturned
            ? "この内容で差し戻しを確定する"
            : "差し戻す（やり直しをお願いする）"}
        </button>
        {feedbackId && (
          <button
            type="submit"
            name="decision"
            value="discard"
            disabled={isPending}
            className="rounded-xl border-2 border-line px-5 py-2 font-bold text-ink-soft transition hover:bg-page disabled:opacity-50"
          >
            AI下書きを破棄
          </button>
        )}
      </div>
      <p className="text-xs text-ink-soft">
        「合格」は案件を完了にします。「差し戻す」は利用者の画面に「やり直し」として表示され、
        もう一度提出できるようになります。
      </p>
    </form>
  );
}
