import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronRight } from "./icons";

interface SectionCardProps {
  title?: string;
  icon?: ReactNode;
  /** 右上の「すべて見る」等のリンク */
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
  /** カード内側の余白を無効化（テーブル等をフチまで表示する時） */
  flush?: boolean;
}

/** 白背景・角丸16px・薄い枠線の共通カード */
export function SectionCard({
  title,
  icon,
  action,
  children,
  className = "",
  flush = false,
}: SectionCardProps) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pb-0 pt-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            {icon && (
              <span aria-hidden className="text-primary">
                {icon}
              </span>
            )}
            {title}
          </h2>
          {action && (
            <Link
              href={action.href}
              className="flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary hover:text-primary-dark hover:underline"
            >
              {action.label}
              <IconChevronRight className="size-4" />
            </Link>
          )}
        </div>
      )}
      <div className={flush ? "pt-3" : "p-5 pt-3"}>{children}</div>
    </section>
  );
}
