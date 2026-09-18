"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { askQuestion, type ActionState } from "@/lib/actions/assignments";

/** メッセージ画面で選べる案件の候補 */
export interface QuestionTaskOption {
  assignmentId: string;
  title: string;
}

interface QuestionFormProps {
  /** 案件詳細から開いたときは、その案件に固定する */
  assignmentId?: string;
  /**
   * メッセージ画面から開いたときは、案件を選べるようにする。
   * 空配列や未指定なら「特定の案件ではない質問」だけを送る。
   */
  taskOptions?: QuestionTaskOption[];
}

const initialState: ActionState = { error: null };

/** 職員への質問フォーム（案件詳細・メッセージ画面の両方で使う） */
export function QuestionForm({ assignmentId, taskOptions }: QuestionFormProps) {
  const [state, formAction, isPending] = useActionState(
    askQuestion,
    initialState,
  );
  const [showDone, setShowDone] = useState(false);

  const canSelectTask = !assignmentId && (taskOptions?.length ?? 0) > 0;

  // 送信が成功するたびに完了ポップアップを表示する。
  // （フォームは残るので、続けて質問を送れる。effect ではなく描画中に state を合わせる）
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.success) setShowDone(true);
  }

  // 数秒で自動的に閉じる
  useEffect(() => {
    if (!showDone) return;
    const timer = setTimeout(() => setShowDone(false), 4000);
    return () => clearTimeout(timer);
  }, [showDone]);

  return (
    <>
      <form action={formAction} className="space-y-3">
        {assignmentId && (
          <input type="hidden" name="assignment_id" value={assignmentId} />
        )}

        {canSelectTask && (
          <div className="space-y-1">
            <label
              htmlFor="assignment_id"
              className="block text-lg font-bold text-ink"
            >
              どの案件についてですか?
            </label>
            <select
              id="assignment_id"
              name="assignment_id"
              defaultValue=""
              className="min-h-12 w-full rounded-xl border-2 border-line bg-surface p-3 text-lg focus:border-primary focus:outline-none"
            >
              <option value="">特定の案件ではない質問</option>
              {taskOptions!.map((opt) => (
                <option key={opt.assignmentId} value={opt.assignmentId}>
                  {opt.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <label htmlFor="question" className="block text-lg font-bold text-ink">
          ❓ わからないことを質問する
        </label>
        <textarea
          id="question"
          name="question"
          rows={3}
          placeholder="例: テロップの文字の大きさはどれくらいですか?"
          className="w-full rounded-xl border-2 border-line p-3 text-lg focus:border-primary focus:outline-none"
        />
        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft p-3 font-bold text-danger"
          >
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 w-full rounded-2xl border-2 border-primary/40 bg-primary-soft text-lg font-bold text-primary-dark transition hover:bg-primary-soft disabled:opacity-50"
        >
          {isPending ? "送信中…" : "質問を送る"}
        </button>
      </form>

      {showDone && (
        <QuestionDonePopup onClose={() => setShowDone(false)} />
      )}
    </>
  );
}

/** 送信完了を知らせるポップアップ（中央モーダル） */
function QuestionDonePopup({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-done-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-surface p-7 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-3xl">
          ✅
        </div>
        <p
          id="question-done-title"
          className="mt-4 text-xl font-bold text-ink"
          aria-live="assertive"
        >
          送信が完了しました
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          返事は「メッセージ」に届きます。作業は続けて大丈夫です。
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-2xl bg-primary text-lg font-bold text-white transition hover:bg-primary-dark"
        >
          とじる
        </button>
      </div>
    </div>
  );
}
