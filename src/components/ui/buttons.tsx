import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Link にも使えるクラス文字列（角丸10px・クリック領域44px確保） */
export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-primary/40 bg-surface px-5 py-2.5 font-bold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 py-2 font-medium text-ink-soft transition hover:bg-page hover:text-ink";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PrimaryButton({ children, className = "", ...rest }: ButtonProps) {
  return (
    <button {...rest} className={`${primaryButtonClass} ${className}`}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...rest }: ButtonProps) {
  return (
    <button {...rest} className={`${secondaryButtonClass} ${className}`}>
      {children}
    </button>
  );
}
