"use client";

import { useActionState } from "react";
import { runAiReview } from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/assignments";

interface RunAiReviewFormProps {
  submissionId: string;
  label?: string;
}

const initialState: ActionState = { error: null };

/** 提出物のAIレビューを手動で実行（提出時に作られなかった分の救済・やり直し） */
export function RunAiReviewForm({
  submissionId,
  label = "AIレビューを実行する",
}: RunAiReviewFormProps) {
  const [state, formAction, isPending] = useActionState(runAiReview, initialState);

  if (state.success) {
    return (
      <p className="text-sm font-bold text-success">
        AIレビューを作りました。画面を再読み込みすると反映されます。
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="submission_id" value={submissionId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl border-2 border-primary px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-soft disabled:opacity-50"
      >
        {isPending ? "実行しています…" : label}
      </button>
      {state.error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
