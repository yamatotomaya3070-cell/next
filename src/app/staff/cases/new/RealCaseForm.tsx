"use client";

import { useActionState } from "react";
import {
  previewSimilarCase,
  saveSimilarCase,
  type SimilarCasePreviewState,
} from "@/lib/actions/cases";
import { SKILL_TAG_LABELS } from "@/lib/types";
import type { ActionState } from "@/lib/actions/assignments";

const initialPreviewState: SimilarCasePreviewState = { error: null };
const initialSaveState: ActionState = { error: null };

export function RealCaseForm() {
  const [state, previewAction, isGenerating] = useActionState(
    previewSimilarCase,
    initialPreviewState,
  );
  const [saveState, saveAction, isSaving] = useActionState(
    saveSimilarCase,
    initialSaveState,
  );
  const preview = state.preview;

  return (
    <div className="space-y-8">
      <form
        action={previewAction}
        className="space-y-5 rounded-2xl border border-line bg-surface p-6"
      >
        <div>
          <label htmlFor="raw_case_text" className="block font-bold text-ink">
            実案件の依頼文 <span className="text-danger">*</span>
          </label>
          <p className="mt-1 text-sm text-ink-soft">
            クラウドワークス等の依頼文・依頼メールをそのまま貼り付けてください。
            固有名詞や連絡先はAIが匿名化しますが、保存前に必ずこの画面で確認します。
          </p>
          <textarea
            id="raw_case_text"
            name="raw_case_text"
            rows={10}
            required
            defaultValue={state.rawCaseText}
            placeholder="例: 【急募】飲食店のPR動画編集をお願いします…"
            className="mt-2 w-full rounded-xl border-2 border-line p-3 font-mono text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="difficulty" className="block font-bold text-ink">
              難易度
            </label>
            <select
              id="difficulty"
              name="difficulty"
              defaultValue=""
              className="mt-1 w-full rounded-xl border-2 border-line p-3"
            >
              <option value="">おまかせ（実案件から推定）</option>
              <option value={1}>★ いちばん簡単</option>
              <option value={2}>★★ 簡単</option>
              <option value={3}>★★★ ふつう</option>
              <option value={4}>★★★★ むずかしい</option>
              <option value={5}>★★★★★ 実務レベル</option>
            </select>
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
            ? "AIが匿名化と類似案件の生成をしています…（1分ほどかかります）"
            : "AIで類似の練習案件を生成する"}
        </button>
      </form>

      {preview && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold">生成結果の確認</h2>

          <div className="rounded-2xl border-2 border-warning/40 bg-warning-soft p-6">
            <h3 className="font-bold text-amber-900">
              🔒 匿名化レポート（保存前に必ず確認してください）
            </h3>
            <div className="mt-3 space-y-4 text-sm">
              <div>
                <p className="font-bold text-ink">置換・削除した情報</p>
                {preview.maskingReport.removedItems.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5 text-ink">
                    {preview.maskingReport.removedItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-soft">（記録なし）</p>
                )}
              </div>
              <div>
                <p className="font-bold text-rose-700">要確認（残っている可能性のある情報）</p>
                <ul className="mt-1 list-disc pl-5 text-danger">
                  {preview.maskingReport.riskNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                  <li>
                    下の「匿名化済みテキスト」に店名・人名・特定につながる情報が
                    残っていないか目視で確認してください。
                  </li>
                </ul>
              </div>
              <details className="rounded-xl bg-surface p-3">
                <summary className="cursor-pointer font-bold text-ink">
                  匿名化済みテキストを表示
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-ink">
                  {preview.maskedCaseText}
                </pre>
              </details>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{preview.title}</h3>
              <span className="rounded-full bg-page px-3 py-1 text-sm">
                難易度 {"★".repeat(preview.difficulty)}
              </span>
              {preview.skillTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary"
                >
                  {SKILL_TAG_LABELS[tag] ?? tag}
                </span>
              ))}
              <span className="text-sm text-ink-soft/70">
                生成: {preview.provider}
              </span>
            </div>
            <p className="mt-2 text-ink-soft">{preview.summary}</p>

            {preview.cautionPoints.length > 0 && (
              <div className="mt-3 rounded-xl bg-teal-soft p-4 text-sm">
                <p className="font-bold text-teal">
                  この案件の注意事項（ナレッジとして自動蓄積されます）
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                  {preview.cautionPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <details open className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">模擬依頼書</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">
                  {preview.requestDoc}
                </pre>
              </details>
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">
                  手順書（{preview.manualSteps.length}ステップ）
                </summary>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink">
                  {preview.manualSteps.map((step, i) => (
                    <li key={i}>
                      {step.text}
                      {step.tip && (
                        <span className="block text-ink-soft">💡 {step.tip}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
              {preview.script && (
                <details className="rounded-xl border border-line p-4">
                  <summary className="cursor-pointer font-bold">字幕用の台本</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">
                    {preview.script}
                  </pre>
                </details>
              )}
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">
                  修正指示（初回納品後に模擬クライアントから送る文面）
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">
                  {preview.revisionNote}
                </pre>
              </details>
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">完成見本の説明</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">
                  {preview.sampleDescription}
                </pre>
              </details>
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">納品前チェックリスト</summary>
                <ul className="mt-2 list-disc pl-5 text-sm text-ink">
                  {preview.selfCheckItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          {/* レベル調整: 同じ実案件から難易度だけを変えて作り直す（段階的なレベルアップ用） */}
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h3 className="text-lg font-bold">レベルを調整して作り直す</h3>
            <p className="mt-1 text-sm text-ink-soft">
              同じ実案件から、難易度だけを変えて練習案件を作り直せます。利用者の習熟に合わせて少しずつレベルを上げていくのに使えます。
            </p>
            <p className="mt-3">
              <span className="rounded-full bg-page px-3 py-1 text-sm">
                いまのレベル: {"★".repeat(preview.difficulty)}（{preview.difficulty}/5）
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {preview.difficulty < 5 && (
                <form action={previewAction}>
                  <input type="hidden" name="raw_case_text" value={state.rawCaseText ?? ""} />
                  <input type="hidden" name="trainee_note" value={state.traineeNote ?? ""} />
                  <input type="hidden" name="difficulty" value={preview.difficulty + 1} />
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="min-h-12 rounded-xl bg-primary px-5 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
                  >
                    ⬆ もう一段むずかしくして作り直す（レベル{preview.difficulty + 1}）
                  </button>
                </form>
              )}
              {preview.difficulty > 1 && (
                <form action={previewAction}>
                  <input type="hidden" name="raw_case_text" value={state.rawCaseText ?? ""} />
                  <input type="hidden" name="trainee_note" value={state.traineeNote ?? ""} />
                  <input type="hidden" name="difficulty" value={preview.difficulty - 1} />
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="min-h-12 rounded-xl border-2 border-line px-5 font-bold text-ink transition hover:bg-page disabled:opacity-50"
                  >
                    ⬇ 少しやさしくして作り直す（レベル{preview.difficulty - 1}）
                  </button>
                </form>
              )}
            </div>
            {isGenerating && (
              <p className="mt-2 text-sm text-ink-soft">
                作り直しています…（1分ほどかかります）
              </p>
            )}
          </div>

          <form action={saveAction} className="space-y-3">
            <input
              type="hidden"
              name="payload"
              value={JSON.stringify(preview)}
            />
            {saveState.error && (
              <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
                {saveState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-14 w-full rounded-2xl bg-success text-lg font-bold text-white shadow-md transition hover:bg-success/90 disabled:opacity-50"
            >
              {isSaving
                ? "保存しています…"
                : "匿名化を確認しました。下書きとして保存する"}
            </button>
            <p className="text-center text-sm text-ink-soft">
              保存後も、各教材を承認するまで利用者には表示されません。
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
