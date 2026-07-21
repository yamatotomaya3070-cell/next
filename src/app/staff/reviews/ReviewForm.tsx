"use client";

import { useActionState } from "react";
import { reviewFeedback } from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/assignments";

interface ReviewFormProps {
  feedbackId: string;
  assignmentId: string;
  defaultScore: number;
  defaultSummary: string;
}

const initialState: ActionState = { error: null };

export function ReviewForm({
  feedbackId,
  assignmentId,
  defaultScore,
  defaultSummary,
}: ReviewFormProps) {
  const [state, formAction, isPending] = useActionState(
    reviewFeedback,
    initialState,
  );

  if (state.success) {
    return <p className="font-bold text-success">処理しました ✅</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="feedback_id" value={feedbackId} />
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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="mark_completed"
          className="h-5 w-5 accent-success"
        />
        この案件を「完了」にする（十分な出来の場合）
      </label>

      {state.error && (
        <p role="alert" className="font-bold text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={isPending}
          className="rounded-xl bg-success px-5 py-2 font-bold text-white transition hover:bg-success/90 disabled:opacity-50"
        >
          承認して利用者に公開
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={isPending}
          className="rounded-xl border-2 border-line px-5 py-2 font-bold text-ink-soft transition hover:bg-page disabled:opacity-50"
        >
          破棄する
        </button>
      </div>
    </form>
  );
}
