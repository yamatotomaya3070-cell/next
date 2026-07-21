"use client";

import { useRef, type ReactNode } from "react";
import { primaryButtonClass, secondaryButtonClass } from "./buttons";

interface ConfirmSubmitButtonProps {
  /** 確認ダイアログの見出し */
  title: string;
  /** 何が起きるかを具体的に伝える説明文 */
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * 誤操作防止つき送信ボタン。
 * フォーム内に置くと、クリック時に確認ダイアログを挟んでから送信する。
 */
export function ConfirmSubmitButton({
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  className = primaryButtonClass,
  disabled,
  children,
}: ConfirmSubmitButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const confirm = () => {
    dialogRef.current?.close();
    buttonRef.current?.form?.requestSubmit();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => dialogRef.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-dialog-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-6 shadow-card-hover backdrop:bg-ink/40"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => dialogRef.current?.close()}
          >
            {cancelLabel}
          </button>
          <button type="button" className={primaryButtonClass} onClick={confirm}>
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
