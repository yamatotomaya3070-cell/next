"use client";

import { useId, useRef, useState } from "react";
import type { CheckItem, PracticeCheckId } from "@/lib/guide/practiceCheck/checks";
import { PracticeCheckError, runPracticeCheck } from "@/lib/guide/practiceCheck/runInBrowser";
import { IconAlert, IconCheckCircle, IconVideo } from "@/components/ui/icons";

interface PracticeCheckProps {
  checkId: PracticeCheckId;
}

type State =
  | { kind: "idle" }
  | { kind: "running"; name: string }
  | { kind: "done"; name: string; items: CheckItem[] }
  | { kind: "error"; message: string };

/** 書き出した練習の動画をえらぶと、その場で機械で見られる所だけを確かめる。動画はどこにも送らない */
export function PracticeCheck({ checkId }: PracticeCheckProps) {
  const inputId = useId();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isOver, setIsOver] = useState(false);
  // 調べている途中に別のファイルをえらんでも、前の結果で上書きしない
  const runRef = useRef(0);
  const isRunning = state.kind === "running";

  const check = async (file: File | undefined) => {
    if (!file || isRunning) return;
    const run = ++runRef.current;
    setState({ kind: "running", name: file.name });
    try {
      const items = await runPracticeCheck(checkId, file);
      if (run === runRef.current) setState({ kind: "done", name: file.name, items });
    } catch (e) {
      if (run === runRef.current) {
        setState({ kind: "error", message: e instanceof PracticeCheckError ? e.message : "調べている途中で止まりました。もう一度えらびます。" });
      }
    }
  };

  const ngCount = state.kind === "done" ? state.items.filter((i) => !i.ok).length : 0;

  return (
    <section aria-labelledby={`${inputId}-title`} className="rounded-2xl border-2 border-primary/30 bg-surface p-5">
      <h2 id={`${inputId}-title`} className="flex items-center gap-2 text-xl font-bold text-ink">
        <IconVideo className="size-6 text-primary" />
        書き出した動画で、すぐ確かめる
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        1-5 と同じ設定で書き出した動画をえらぶと、音を調べて、すぐ結果が出ます。動画はどこにも送られません（このパソコンの中だけで調べます）。
      </p>

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          void check(e.dataTransfer.files[0]);
        }}
        className={`mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
          isOver ? "border-primary bg-primary-soft/40" : "border-line bg-page hover:border-primary/50"
        }`}
      >
        <span className="text-base font-bold text-primary">動画をえらぶ</span>
        <span className="text-sm text-ink-soft">ここへドラッグしても入れられます（MP4）</span>
        <input
          id={inputId}
          type="file"
          accept="video/mp4,.mp4,.mov"
          disabled={isRunning}
          className="sr-only"
          onChange={(e) => {
            void check(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <div aria-live="polite" className="mt-4">
        {state.kind === "running" && <p className="text-[15px] text-ink-soft">「{state.name}」を調べています…</p>}
        {state.kind === "error" && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-[15px] font-bold text-red-800">
            <IconAlert className="mt-0.5 size-5 shrink-0" />
            {state.message}
          </p>
        )}
        {state.kind === "done" && (
          <div>
            <p className={`text-lg font-bold ${ngCount === 0 ? "text-success" : "text-red-700"}`}>
              {ngCount === 0 ? "機械で見られる所は、全部できています" : `直す所が ${ngCount}つ あります`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">「{state.name}」</p>
            <ul className="mt-3 space-y-2">
              {state.items.map((item) => (
                <li
                  key={item.text}
                  className={`flex gap-2 rounded-xl p-3 text-[16px] leading-relaxed ${item.ok ? "bg-success-soft/40 text-ink" : "bg-red-50 text-red-900"}`}
                >
                  {item.ok ? <IconCheckCircle className="mt-1 size-5 shrink-0 text-success" /> : <IconAlert className="mt-1 size-5 shrink-0 text-red-700" />}
                  <span>
                    <span className="sr-only">{item.ok ? "できています：" : "直す所："}</span>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-soft">
              ここで見るのは音と書き出しの設定だけです。聞いた感じや見た目は、下の「できたか確かめる」で自分で確かめます。直したら、書き出し直してもう一度えらびます。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
