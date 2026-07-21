"use client";

import { useActionState } from "react";
import { updateAccessibilitySettings } from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/assignments";
import type { Profile } from "@/lib/types";

const initialState: ActionState = { error: null };

const TOGGLES: Array<{
  name: string;
  key: keyof Profile;
  label: string;
  description: string;
}> = [
  {
    name: "furigana_enabled",
    key: "furigana_enabled",
    label: "ふりがなを表示する",
    description: "漢字の上に読みがなが出ます",
  },
  {
    name: "step_mode_enabled",
    key: "step_mode_enabled",
    label: "手順を一つずつ表示する",
    description: "作業のやり方が1画面に1つずつ出ます",
  },
  {
    name: "large_text_enabled",
    key: "large_text_enabled",
    label: "文字を大きくする",
    description: "画面全体の文字が大きくなります",
  },
  {
    name: "read_aloud_enabled",
    key: "read_aloud_enabled",
    label: "読み上げボタンを表示する",
    description: "文章を音声で読み上げるボタンが出ます",
  },
];

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, formAction, isPending] = useActionState(
    updateAccessibilitySettings,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="user_id" value={profile.id} />

      {TOGGLES.map((toggle) => (
        <label
          key={toggle.name}
          className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line p-4 hover:bg-page"
        >
          <span>
            <span className="block text-lg font-bold text-ink">
              {toggle.label}
            </span>
            <span className="text-sm text-ink-soft">{toggle.description}</span>
          </span>
          <input
            type="checkbox"
            name={toggle.name}
            defaultChecked={Boolean(profile[toggle.key])}
            className="h-7 w-7 shrink-0 rounded accent-primary"
          />
        </label>
      ))}

      <div className="rounded-2xl border border-line p-4">
        <label
          htmlFor="break_interval_minutes"
          className="block text-lg font-bold text-ink"
        >
          休憩のお知らせ
        </label>
        <p className="text-sm text-ink-soft">
          何分ごとに休憩のお知らせを出すか選べます
        </p>
        <select
          id="break_interval_minutes"
          name="break_interval_minutes"
          defaultValue={profile.break_interval_minutes}
          className="mt-2 w-full rounded-xl border-2 border-line p-3 text-lg"
        >
          <option value={30}>30分ごと</option>
          <option value={50}>50分ごと</option>
          <option value={60}>60分ごと</option>
          <option value={90}>90分ごと</option>
        </select>
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-xl bg-success-soft p-4 font-bold text-success">
          保存しました ✅
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "保存しています…" : "保存する"}
      </button>
    </form>
  );
}
