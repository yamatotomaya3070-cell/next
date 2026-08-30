"use client";

import { useActionState, useTransition } from "react";
import {
  addManualGuideline,
  setManualGuidelineActive,
} from "@/lib/actions/manualSteps";
import type { ActionState } from "@/lib/actions/assignments";
import { SKILL_TAG_LABELS } from "@/lib/types";

const initial: ActionState = { error: null };

const ALL_SKILL_TAGS = Object.keys(SKILL_TAG_LABELS);

/** 新しい学習ルールを直接追加するフォーム（案件を経由せずに登録したいとき用）。 */
export function NewGuidelineForm() {
  const [state, action, pending] = useActionState(addManualGuideline, initial);

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">見出し（短い要約）</span>
        <input
          name="title"
          required
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          placeholder="例: 完成見本を見る手順を書かない"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">
          ルール（AIに守らせること）
        </span>
        <textarea
          name="rule"
          required
          rows={2}
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">
          理由（なぜ直すのか）※必須
        </span>
        <textarea
          name="reason"
          required
          rows={2}
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">NG例（任意）</span>
          <textarea
            name="example_before"
            rows={2}
            className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">OK例（任意）</span>
          <textarea
            name="example_after"
            rows={2}
            className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-xs font-bold text-ink-soft">
          対象スキル（選ばなければ全案件に適用）
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ALL_SKILL_TAGS.map((tag) => (
            <label
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs"
            >
              <input type="checkbox" name="skill_tags" value={tag} />
              {SKILL_TAG_LABELS[tag] ?? tag}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "登録中…" : "ルールを追加する"}
        </button>
        {state.success && (
          <span className="font-bold text-success">登録しました ✅</span>
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

/** 学習ルールの有効/無効を切り替えるボタン。無効化すると以後の生成に注入されない。 */
export function ToggleActiveButton({
  guidelineId,
  isActive,
}: {
  guidelineId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setManualGuidelineActive(guidelineId, !isActive);
        })
      }
      className={`min-h-9 rounded-full px-3 py-1 text-xs font-bold transition disabled:opacity-50 ${
        isActive
          ? "bg-success-soft text-success hover:bg-success/20"
          : "bg-page text-ink-soft hover:bg-line/40"
      }`}
    >
      {pending ? "…" : isActive ? "有効（クリックで無効化）" : "無効（クリックで有効化）"}
    </button>
  );
}
