import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft } from "@/components/ui/icons";

/**
 * チャット画面の外枠。ヘッダー(4.5rem)とモバイルのメニュー帯を除いた高さいっぱいを使い、
 * 中のトークだけがスクロールするようにする。
 */
export function ChatViewport({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-[calc(100dvh-4.5rem-3.75rem)] w-full overflow-hidden md:h-[calc(100dvh-4.5rem)] ${className}`}
    >
      {children}
    </div>
  );
}

interface ChatFrameProps {
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  /** モバイルで一覧へ戻るリンク（職員側） */
  backHref?: string;
  /** 右端の補助リンク等 */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** トーク1本分の枠（上に相手の名前、下に本文＋入力欄） */
export function ChatFrame({
  title,
  subtitle,
  avatar,
  backHref,
  action,
  children,
  className = "",
}: ChatFrameProps) {
  return (
    <section
      aria-label={`${title}とのトーク`}
      className={`min-h-0 min-w-0 flex-1 flex-col bg-surface ${className}`}
    >
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 md:px-5">
        {backHref && (
          <Link
            href={backHref}
            aria-label="一覧へ戻る"
            className="-ml-1 flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-page hover:text-ink md:hidden"
          >
            <IconArrowLeft />
          </Link>
        )}
        {avatar}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs leading-tight text-ink-soft">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
