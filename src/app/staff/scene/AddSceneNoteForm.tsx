"use client";

import { useActionState } from "react";
import { addSceneNote } from "@/lib/actions/sceneJobs";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState = { error: null };

export function AddSceneNoteForm() {
  const [state, formAction, isPending] = useActionState(addSceneNote, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-ink-soft">
        生成した動画・仕様書の不備や、読み方の誤りを記録すると、
        <b>次回以降の生成（台本・音声）に自動で反映</b>されます。使うほど品質が上がります。
      </p>

      <div>
        <label htmlFor="note" className="block text-sm font-bold text-ink">
          気づいた点・直したいこと
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          placeholder="例: まとめ図のテロップは短くする / 数値は最新の制度に合わせる"
          className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="term" className="block text-sm font-bold text-ink">
            読み方を直す言葉（任意）
          </label>
          <input
            id="term"
            name="term"
            type="text"
            placeholder="例: iDeCo"
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          />
        </div>
        <div>
          <label htmlFor="reading" className="block text-sm font-bold text-ink">
            正しい読み（任意）
          </label>
          <input
            id="reading"
            name="reading"
            type="text"
            placeholder="例: イデコ"
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-xl bg-success-soft p-3 text-sm font-bold text-success">
          記録しました。次の生成から反映されます。
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 rounded-xl bg-primary px-5 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "記録中…" : "ナレッジに追加"}
      </button>
    </form>
  );
}
