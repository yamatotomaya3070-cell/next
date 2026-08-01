"use client";

import { useActionState, useState } from "react";
import {
  previewCaseGuide,
  distributeRealCase,
  type CaseGuidePreviewState,
} from "@/lib/actions/cases";
import { SKILL_TAG_LABELS } from "@/lib/types";
import type { ActionState } from "@/lib/actions/assignments";

const initialPreview: CaseGuidePreviewState = { error: null };
const initialDistribute: ActionState = { error: null };

export interface TraineeOption {
  id: string;
  name: string;
}

export function DistributeCaseForm({ trainees }: { trainees: TraineeOption[] }) {
  const [state, previewAction, isGenerating] = useActionState(previewCaseGuide, initialPreview);
  const [distState, distributeAction, isDistributing] = useActionState(
    distributeRealCase,
    initialDistribute,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const guide = state.guide;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-8">
      {/* STEP 1: 実案件を貼り付けて手順書を生成 */}
      <form
        action={previewAction}
        className="space-y-5 rounded-2xl border border-line bg-surface p-6"
      >
        <div>
          <label htmlFor="case_text" className="block font-bold text-ink">
            案件の依頼文 <span className="text-danger">*</span>
          </label>
          <p className="mt-1 text-sm text-ink-soft">
            クラウドワークス等で受注した案件の依頼文・依頼メールをそのまま貼り付けてください。
            この案件を利用者にそのまま配布します。AIが読みやすい依頼書と手順書を用意します。
          </p>
          <textarea
            id="case_text"
            name="case_text"
            rows={9}
            required
            defaultValue={state.caseText}
            placeholder="例: 飲食店の紹介動画（60秒・縦型）の編集をお願いします…"
            className="mt-2 w-full rounded-xl border-2 border-line p-3 font-mono text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="trainee_note" className="block font-bold text-ink">
            利用者への配慮メモ（任意）
          </label>
          <textarea
            id="trainee_note"
            name="trainee_note"
            rows={2}
            defaultValue={state.traineeNote}
            placeholder="例: 手順は特に短く区切ってほしい"
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
          disabled={isGenerating}
          className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
        >
          {isGenerating
            ? "AIが依頼書と手順書を用意しています…（1分ほどかかります）"
            : "依頼書と手順書を用意する"}
        </button>
      </form>

      {/* STEP 2: 内容を確認して、利用者を選んで配布 */}
      {guide && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold">配布する内容の確認</h2>

          <div className="rounded-2xl border border-line bg-surface p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{guide.title}</h3>
              <span className="rounded-full bg-page px-3 py-1 text-sm">
                難易度 {"★".repeat(guide.difficulty)}
              </span>
              {guide.skillTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary"
                >
                  {SKILL_TAG_LABELS[tag] ?? tag}
                </span>
              ))}
              <span className="text-sm text-ink-soft/70">生成: {guide.provider}</span>
            </div>
            <p className="mt-2 text-ink-soft">{guide.summary}</p>

            <div className="mt-4 space-y-3">
              <details open className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">依頼書（利用者に配布）</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">
                  {guide.readableRequestDoc}
                </pre>
              </details>
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">
                  手順書（{guide.manualSteps.length}ステップ・利用者に配布）
                </summary>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink">
                  {guide.manualSteps.map((step, i) => (
                    <li key={i}>
                      {step.text}
                      {step.tip && <span className="block text-ink-soft">💡 {step.tip}</span>}
                    </li>
                  ))}
                </ol>
              </details>
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">納品前チェックリスト</summary>
                <ul className="mt-2 list-disc pl-5 text-sm text-ink">
                  {guide.selfCheckItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          {/* 配布先の利用者を選ぶ */}
          <form action={distributeAction} className="space-y-4 rounded-2xl border-2 border-primary/30 bg-primary-soft/40 p-6">
            <input type="hidden" name="payload" value={JSON.stringify(guide)} />
            <input type="hidden" name="case_text" value={state.caseText ?? ""} />
            {selected.map((id) => (
              <input key={id} type="hidden" name="user_ids" value={id} />
            ))}

            <div>
              <p className="font-bold text-ink">配布する利用者を選ぶ <span className="text-danger">*</span></p>
              {trainees.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">
                  利用者がまだ登録されていません。「利用者」ページから追加してください。
                </p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {trainees.map((t) => (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition ${
                        selected.includes(t.id)
                          ? "border-primary bg-surface"
                          : "border-line bg-surface hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(t.id)}
                        onChange={() => toggle(t.id)}
                        className="h-5 w-5"
                      />
                      <span className="font-bold text-ink">{t.name} さん</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="due_days" className="block font-bold text-ink">
                提出期限（日数）
              </label>
              <input
                id="due_days"
                name="due_days"
                type="number"
                min={1}
                max={60}
                defaultValue={5}
                className="mt-1 w-32 rounded-xl border-2 border-line p-3"
              />
            </div>

            {distState.error && (
              <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
                {distState.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isDistributing || selected.length === 0}
              className="min-h-14 w-full rounded-2xl bg-success text-lg font-bold text-white shadow-md transition hover:bg-success/90 disabled:opacity-50"
            >
              {isDistributing
                ? "配布しています…"
                : selected.length > 0
                  ? `この案件を ${selected.length} 人に配布する`
                  : "配布する利用者を選んでください"}
            </button>
            <p className="text-center text-sm text-ink-soft">
              配布すると、選んだ利用者の「受注案件」にこの案件・依頼書・手順書が届きます。
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
