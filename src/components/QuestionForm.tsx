"use client";

import { useActionState } from "react";
import { askQuestion, type ActionState } from "@/lib/actions/assignments";

interface QuestionFormProps {
  assignmentId?: string;
}

const initialState: ActionState = { error: null };

/** 職員への質問フォーム */
export function QuestionForm({ assignmentId }: QuestionFormProps) {
  const [state, formAction, isPending] = useActionState(
    askQuestion,
    initialState,
  );

  if (state.success) {
    return (
      <div className="rounded-2xl bg-primary-soft p-5 text-center">
        <p className="text-lg font-bold text-primary-dark">質問を送りました 📨</p>
        <p className="mt-1 text-primary-dark">
          職員からの返事を待ってください。作業は続けて大丈夫です。
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {assignmentId && (
        <input type="hidden" name="assignment_id" value={assignmentId} />
      )}
      <label
        htmlFor="question"
        className="block text-lg font-bold text-ink"
      >
        ❓ わからないことを質問する
      </label>
      <textarea
        id="question"
        name="question"
        rows={3}
        placeholder="例: テロップの文字の大きさはどれくらいですか?"
        className="w-full rounded-xl border-2 border-line p-3 text-lg focus:border-primary focus:outline-none"
      />
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 font-bold text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="min-h-12 w-full rounded-2xl border-2 border-primary/40 bg-primary-soft text-lg font-bold text-primary-dark transition hover:bg-primary-soft disabled:opacity-50"
      >
        {isPending ? "送信中…" : "質問を送る"}
      </button>
    </form>
  );
}
