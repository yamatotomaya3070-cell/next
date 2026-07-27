"use client";

import { useActionState } from "react";
import { recordTransferApproval } from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState = { error: null };

interface TransferApprovalFormProps {
  userId: string;
  isApproved: boolean;
}

export function TransferApprovalForm({
  userId,
  isApproved,
}: TransferApprovalFormProps) {
  const [state, formAction, isPending] = useActionState(
    recordTransferApproval,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="user_id" value={userId} />
      <input
        type="hidden"
        name="decision"
        value={isApproved ? "revoked" : "approved"}
      />
      <textarea
        name="note"
        rows={2}
        placeholder="所見（任意）: 承認の理由や条件、注意点など"
        className="w-full rounded-xl border-2 border-line p-2 text-sm focus:border-primary focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className={`min-h-11 rounded-xl px-5 font-bold text-white transition disabled:opacity-50 ${
            isApproved
              ? "bg-ink-soft hover:bg-ink"
              : "bg-success hover:bg-success/90"
          }`}
        >
          {isPending
            ? "記録中…"
            : isApproved
              ? "本番移行の承認を取り消す"
              : "本番移行を承認する"}
        </button>
        {state.success && (
          <span className="font-bold text-success">記録しました ✅</span>
        )}
        {state.error && (
          <span role="alert" className="font-bold text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
