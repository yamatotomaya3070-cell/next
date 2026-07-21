"use client";

import { useActionState } from "react";
import { recordAptitude } from "@/lib/actions/staff";
import { APTITUDE_LABELS, type AptitudeKey } from "@/lib/types";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState = { error: null };

export function AptitudeForm({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(
    recordAptitude,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />

      <div className="flex flex-wrap gap-3">
        <label className="block flex-1">
          <span className="text-sm font-bold text-ink-soft">項目</span>
          <select
            name="key"
            className="mt-1 block w-full rounded-xl border-2 border-line px-3 py-2"
          >
            {(Object.keys(APTITUDE_LABELS) as AptitudeKey[]).map((key) => (
              <option key={key} value={key}>
                {APTITUDE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-bold text-ink-soft">評価</span>
          <select
            name="rating"
            defaultValue={3}
            className="mt-1 block rounded-xl border-2 border-line px-3 py-2"
          >
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r} {r === 1 ? "(要支援)" : r === 5 ? "(得意)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-bold text-ink-soft">
          観察メモ（任意）
        </span>
        <textarea
          name="note"
          rows={2}
          placeholder="例: 午前中は集中できるが、午後は休憩を多めに"
          className="mt-1 block w-full rounded-xl border-2 border-line px-3 py-2"
        />
      </label>

      {state.error && (
        <p role="alert" className="font-bold text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="font-bold text-success">記録しました ✅</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-primary px-5 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "記録中…" : "記録する"}
      </button>
    </form>
  );
}
