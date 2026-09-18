"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { IconSend } from "@/components/ui/icons";

/** 利用者が「どの案件について」かを選べるときの候補 */
export interface ComposerTaskOption {
  assignmentId: string;
  title: string;
}

interface ChatComposerProps {
  onSend: (body: string, assignmentId: string | null) => Promise<boolean>;
  isPending: boolean;
  error: string | null;
  taskOptions?: ComposerTaskOption[];
  placeholder?: string;
}

/** 入力欄の最大の高さ（これ以上は中でスクロール） */
const MAX_TEXTAREA_HEIGHT = 160;

/** 画面下部に固定する入力欄（Enterで送信・Shift+Enterで改行） */
export function ChatComposer({
  onSend,
  isPending,
  error,
  taskOptions = [],
  placeholder = "メッセージを入力",
}: ChatComposerProps) {
  const [body, setBody] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = body.trim().length > 0 && !isPending;

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // border-box なので枠線の太さ(offsetHeight - clientHeight)を足さないと1行でもスクロールバーが出る
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + borders, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const submit = async () => {
    if (!canSend) return;
    const ok = await onSend(body, assignmentId || null);
    if (!ok) return;
    setBody("");
    setAssignmentId("");
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語入力の変換確定 Enter では送らない
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit();
  };

  return (
    <form
      className="border-t border-line bg-surface px-3 py-2 md:px-4 md:py-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {taskOptions.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor="composer-assignment" className="sr-only">
            どの案件についてですか
          </label>
          <select
            id="composer-assignment"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            className="max-w-full rounded-full border border-line bg-page px-3 py-1.5 text-sm font-medium text-ink focus:border-primary focus:outline-none"
          >
            <option value="">案件を選ぶ（任意）</option>
            {taskOptions.map((opt) => (
              <option key={opt.assignmentId} value={opt.assignmentId}>
                {opt.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          aria-label="メッセージ"
          disabled={isPending}
          className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border-2 border-line bg-page px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-primary focus:bg-surface focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="送信"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-card transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-soft/60 md:w-auto md:gap-1.5 md:px-5"
        >
          <IconSend className="size-5" />
          <span className="hidden text-[15px] font-bold md:inline">
            {isPending ? "送信中…" : "送信"}
          </span>
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        {error ? (
          <p role="alert" className="text-xs font-bold text-danger">
            {error}
          </p>
        ) : (
          <p className="hidden text-[11px] text-ink-soft/80 md:block">
            Enter で送信 ・ Shift + Enter で改行
          </p>
        )}
      </div>
    </form>
  );
}
