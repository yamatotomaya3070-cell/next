"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addManualGuideline,
  updateManualSteps,
} from "@/lib/actions/manualSteps";
import type { ActionState } from "@/lib/actions/assignments";
import type { ManualStep } from "@/lib/types";
import { SKILL_TAG_LABELS } from "@/lib/types";

interface ManualStepsEditorProps {
  taskId: string;
  materialId: string;
  initialSteps: ManualStep[];
  skillTags: string[];
}

const guidelineInitial: ActionState = { error: null };

/**
 * 既存案件の作業手順(steps)を書き換えるエディタ（職員用）。
 * 保存すると task_materials を直接更新し、配布済み就労者にも即反映される。
 * さらに「この修正を学習させる」から、修正理由(なぜ)ごと manual_guidelines に登録でき、
 * 以後のAI生成に自動反映される（毎回手で直す手間を減らす）。
 */
export function ManualStepsEditor({
  taskId,
  materialId,
  initialSteps,
  skillTags,
}: ManualStepsEditorProps) {
  const [steps, setSteps] = useState<ManualStep[]>(
    initialSteps.length > 0
      ? initialSteps.map((s) => ({ text: s.text, tip: s.tip ?? "" }))
      : [{ text: "", tip: "" }],
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showLearn, setShowLearn] = useState(false);

  const [learnState, learnAction, learnPending] = useActionState(
    addManualGuideline,
    guidelineInitial,
  );

  function patch(i: number, key: keyof ManualStep, value: string) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)),
    );
    setSaved(false);
  }

  function addStep() {
    setSteps((prev) => [...prev, { text: "", tip: "" }]);
    setSaved(false);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function move(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSaved(false);
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const payload: ManualStep[] = steps.map((s) => ({
        text: s.text.trim(),
        tip: s.tip?.trim() ? s.tip.trim() : null,
      }));
      const res = await updateManualSteps(taskId, materialId, payload);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="mt-3 space-y-3">
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={i}
            className="rounded-xl border border-line bg-page p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                {i + 1}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="上へ"
                  className="min-h-9 rounded-lg border border-line px-2 text-sm font-bold text-ink-soft transition hover:bg-surface disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  aria-label="下へ"
                  className="min-h-9 rounded-lg border border-line px-2 text-sm font-bold text-ink-soft transition hover:bg-surface disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  aria-label="この手順を削除"
                  className="min-h-9 rounded-lg border border-danger/30 px-2 text-sm font-bold text-danger transition hover:bg-danger/10"
                >
                  削除
                </button>
              </div>
            </div>
            <label className="mt-2 block">
              <span className="text-xs font-bold text-ink-soft">やること</span>
              <textarea
                value={step.text}
                onChange={(e) => patch(i, "text", e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm text-ink"
                placeholder="例: 依頼書とタイミング表で、作るゴールを確認します。"
              />
            </label>
            <label className="mt-2 block">
              <span className="text-xs font-bold text-ink-soft">
                ヒント（任意）
              </span>
              <input
                value={step.tip ?? ""}
                onChange={(e) => patch(i, "tip", e.target.value)}
                className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm text-ink"
                placeholder="例: 依頼書の順番・字幕・テロップが作るゴールです。"
              />
            </label>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addStep}
          className="min-h-11 rounded-xl border-2 border-line bg-surface px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-page"
        >
          ＋ 手順を追加
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {isPending ? "保存中…" : "手順を保存する"}
        </button>
        {saved && <span className="font-bold text-success">保存しました ✅（就労者にも反映）</span>}
        {error && (
          <span role="alert" className="font-bold text-danger">
            {error}
          </span>
        )}
      </div>

      {/* この修正を学習させる（なぜ直したか＝reason ごとDB化してAI生成に反映） */}
      <div className="rounded-xl border border-primary/20 bg-primary-soft/40 p-3">
        <button
          type="button"
          onClick={() => setShowLearn((v) => !v)}
          className="text-sm font-bold text-primary-dark"
        >
          {showLearn ? "▼" : "▶"} この修正を今後の生成にも反映（AIに学習させる）
        </button>
        {showLearn && (
          <form action={learnAction} className="mt-3 space-y-3">
            <input type="hidden" name="source_task_id" value={taskId} />
            <p className="text-xs text-ink-soft">
              「何を直すか(ルール)」と「なぜ直すか(理由)」を登録すると、以後AIが生成する手順に自動で反映され、同じ間違いを繰り返さなくなります。1回登録すれば毎回直す必要はありません。
            </p>
            <label className="block">
              <span className="text-xs font-bold text-ink-soft">
                見出し（短い要約）
              </span>
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
                placeholder="例: 就労者は完成見本を見られないので、手順に『完成見本を見て』と書かない。ゴール確認は依頼書とタイミング表を基準にする。"
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
                placeholder="例: 完成見本は答えなので利用者には非公開。見せていない物を見て確認させる手順は矛盾する。"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-ink-soft">
                  NG例（任意）
                </span>
                <textarea
                  name="example_before"
                  rows={2}
                  className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink-soft">
                  OK例（任意）
                </span>
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
                {skillTags.map((tag) => (
                  <label
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      name="skill_tags"
                      value={tag}
                      defaultChecked
                    />
                    {SKILL_TAG_LABELS[tag] ?? tag}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={learnPending}
                className="min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {learnPending ? "登録中…" : "学習ルールに登録する"}
              </button>
              {learnState.success && (
                <span className="font-bold text-success">
                  登録しました ✅（以後の生成に反映）
                </span>
              )}
              {learnState.error && (
                <span role="alert" className="font-bold text-danger">
                  {learnState.error}
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
