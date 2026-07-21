"use client";

import { useActionState } from "react";
import { createTaskWithAi } from "@/lib/actions/staff";
import { SKILL_TAG_LABELS } from "@/lib/types";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState & { taskId?: string } = { error: null };

export function GenerateTaskForm() {
  const [state, formAction, isPending] = useActionState(
    createTaskWithAi,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="theme"
          className="block font-bold text-ink"
        >
          案件のテーマ <span className="text-danger">*</span>
        </label>
        <input
          id="theme"
          name="theme"
          type="text"
          required
          placeholder="例: 料理動画にテロップを入れる"
          className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="difficulty" className="block font-bold text-ink">
          難易度
        </label>
        <select
          id="difficulty"
          name="difficulty"
          defaultValue={1}
          className="mt-1 w-full rounded-xl border-2 border-line p-3"
        >
          <option value={1}>★ いちばん簡単（初めての人向け）</option>
          <option value={2}>★★ 簡単</option>
          <option value={3}>★★★ ふつう</option>
          <option value={4}>★★★★ むずかしい</option>
          <option value={5}>★★★★★ 実務レベル</option>
        </select>
      </div>

      <fieldset>
        <legend className="font-bold text-ink">
          練習するスキル <span className="text-danger">*</span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(SKILL_TAG_LABELS).map(([tag, label]) => (
            <label
              key={tag}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-3 hover:bg-page"
            >
              <input
                type="checkbox"
                name="skill_tags"
                value={tag}
                className="h-5 w-5 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="trainee_note"
          className="block font-bold text-ink"
        >
          利用者への配慮メモ（任意）
        </label>
        <textarea
          id="trainee_note"
          name="trainee_note"
          rows={2}
          placeholder="例: 長い文章が苦手なので、手順は特に短く区切ってほしい"
          className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "AIが教材を作成しています…（30秒ほどかかります）" : "AIで生成する"}
      </button>
    </form>
  );
}
