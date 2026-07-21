"use client";

import { useState } from "react";
import type { ManualStep } from "@/lib/types";
import { Furigana } from "./Furigana";
import { ProgressBar } from "./ProgressBar";
import { ReadAloudButton } from "./ReadAloudButton";

interface StepViewerProps {
  steps: ManualStep[];
  furiganaEnabled: boolean;
  stepModeEnabled: boolean;
  readAloudEnabled: boolean;
}

/**
 * 手順書ビューア。
 * 一工程ずつ表示モード: 1画面1ステップ + 大きな前へ/次へボタン + 進捗バー
 * 一覧モード: 全ステップを番号付きで表示
 */
export function StepViewer({
  steps,
  furiganaEnabled,
  stepModeEnabled,
  readAloudEnabled,
}: StepViewerProps) {
  const [current, setCurrent] = useState(0);
  const [stepMode, setStepMode] = useState(stepModeEnabled);

  if (steps.length === 0) {
    return <p className="text-ink-soft">手順書はまだ準備中です。</p>;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setStepMode((v) => !v)}
          className="min-h-11 rounded-full border-2 border-line bg-surface px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-page"
        >
          {stepMode ? "ぜんぶ見る" : "一つずつ見る"}
        </button>
      </div>

      {stepMode ? (
        <div>
          <ProgressBar
            percent={Math.round(((current + 1) / steps.length) * 100)}
            label={`手順 ${current + 1} / ${steps.length}`}
          />
          <div className="mt-4 rounded-2xl border-2 border-primary/20 bg-surface p-6 shadow-sm">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
              {current + 1}
            </div>
            <p className="text-xl leading-relaxed text-ink">
              <Furigana text={steps[current].text} enabled={furiganaEnabled} />
            </p>
            {steps[current].tip && (
              <p className="mt-4 rounded-xl bg-warning-soft p-4 text-base leading-relaxed text-amber-900">
                💡 <Furigana text={steps[current].tip!} enabled={furiganaEnabled} />
              </p>
            )}
            {readAloudEnabled && (
              <div className="mt-4">
                <ReadAloudButton
                  text={steps[current].text + "。" + (steps[current].tip ?? "")}
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="min-h-14 flex-1 rounded-2xl border-2 border-line bg-surface text-lg font-bold text-ink transition hover:bg-page disabled:opacity-30"
            >
              ← 前へ
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrent((c) => Math.min(steps.length - 1, c + 1))
              }
              disabled={current === steps.length - 1}
              className="min-h-14 flex-1 rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-30"
            >
              次へ →
            </button>
          </div>
          {current === steps.length - 1 && (
            <p className="mt-4 rounded-xl bg-success-soft p-4 text-center text-lg font-bold text-success">
              🎉 手順はこれで最後です。おつかれさまです!
            </p>
          )}
        </div>
      ) : (
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-lg leading-relaxed text-ink">
                  <Furigana text={step.text} enabled={furiganaEnabled} />
                </p>
                {step.tip && (
                  <p className="mt-1 text-sm text-amber-800">
                    💡 <Furigana text={step.tip} enabled={furiganaEnabled} />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
