"use client";

import { useActionState } from "react";
import { createSceneJob } from "@/lib/actions/sceneJobs";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState = { error: null };

export function CreateSceneJobForm() {
  const [state, formAction, isPending] = useActionState(createSceneJob, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div>
        <label htmlFor="theme" className="block font-bold text-ink">
          動画のテーマ <span className="text-danger">*</span>
        </label>
        <input
          id="theme"
          name="theme"
          type="text"
          required
          placeholder="例: 新NISAって結局何？ / iDeCoの始め方 / 円安ってどういうこと？"
          className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-sm text-ink-soft">
          テーマを入れるだけで、ハル・ミナ先生が会話で解説する横型のYouTube解説動画（完成見本）と、
          就労者がDaVinciで編集するための素材一式・手順書・依頼書を自動で用意します。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="audience" className="block font-bold text-ink">
            想定視聴者
          </label>
          <input
            id="audience"
            name="audience"
            type="text"
            defaultValue="投資初心者"
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          />
        </div>
        <div>
          <label htmlFor="target_minutes" className="block font-bold text-ink">
            目標の長さ（分）
          </label>
          <input
            id="target_minutes"
            name="target_minutes"
            type="number"
            min={3}
            max={15}
            defaultValue={6}
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          />
          <p className="mt-1 text-xs text-ink-soft">3〜15分</p>
        </div>
        <div>
          <label htmlFor="difficulty" className="block font-bold text-ink">
            難易度
          </label>
          <select
            id="difficulty"
            name="difficulty"
            defaultValue={3}
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          >
            <option value={1}>レベル1（やさしい）</option>
            <option value={2}>レベル2</option>
            <option value={3}>レベル3（ふつう）</option>
            <option value={4}>レベル4</option>
            <option value={5}>レベル5（むずかしい）</option>
          </select>
        </div>
      </div>

      <p className="rounded-xl bg-page p-3 text-sm text-ink-soft">
        生成を開始すると、設計図→完成見本→素材→手順書→案件登録の順に処理されます。
        実処理は生成用マシン（ワーカー）が拾って実行するため、反映まで数分かかります。
      </p>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-xl bg-success-soft p-4 font-bold text-success">
          登録しました。下の一覧に「待機中」として表示され、ワーカーが順番に処理します。
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "登録しています…" : "この内容で案件を作る"}
      </button>
    </form>
  );
}
