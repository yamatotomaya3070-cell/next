"use client";

import { useActionState } from "react";
import { assignTask } from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/assignments";

interface AssignFormProps {
  taskId: string;
  trainees: Array<{ id: string; name: string }>;
  assignedCount: number;
  defaultDueDays: number;
}

const initialState: ActionState = { error: null };

export function AssignForm({
  taskId,
  trainees,
  assignedCount,
  defaultDueDays,
}: AssignFormProps) {
  const [state, formAction, isPending] = useActionState(
    assignTask,
    initialState,
  );

  return (
    <div>
      {assignedCount > 0 && (
        <p className="mb-3 text-sm text-ink-soft">
          現在 {assignedCount} 名に割り当て済みです。
        </p>
      )}
      {trainees.length === 0 ? (
        <p className="text-ink-soft">割り当て可能な利用者がいません。</p>
      ) : (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="task_id" value={taskId} />
          <label className="block">
            <span className="text-sm font-bold text-ink-soft">利用者</span>
            <select
              name="user_id"
              className="mt-1 block rounded-xl border-2 border-line px-3 py-2"
            >
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-ink-soft">
              納期（今日から）
            </span>
            <select
              name="due_days"
              defaultValue={defaultDueDays}
              className="mt-1 block rounded-xl border-2 border-line px-3 py-2"
            >
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <option key={d} value={d}>
                  {d}日後
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-primary px-5 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {isPending ? "割り当て中…" : "割り当てる"}
          </button>
          {state.success && (
            <p className="font-bold text-success">割り当てました ✅</p>
          )}
          {state.error && (
            <p role="alert" className="font-bold text-danger">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
