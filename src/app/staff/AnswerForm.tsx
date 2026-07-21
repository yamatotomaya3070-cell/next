"use client";

import { useActionState } from "react";
import { answerQuestion } from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState = { error: null };

export function AnswerForm({ qaId }: { qaId: string }) {
  const [state, formAction, isPending] = useActionState(
    answerQuestion,
    initialState,
  );

  if (state.success) {
    return <p className="font-bold text-success">回答しました ✅</p>;
  }

  return (
    <form action={formAction} className="flex gap-2">
      <input type="hidden" name="qa_id" value={qaId} />
      <input
        type="text"
        name="answer"
        placeholder="回答を入力…"
        className="flex-1 rounded-xl border-2 border-line px-3 py-2 focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-primary px-4 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "送信中…" : "回答する"}
      </button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
