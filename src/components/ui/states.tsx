import type { ReactNode } from "react";
import { IconAlert } from "./icons";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** データが無いときの空表示 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-page/60 px-6 py-10 text-center">
      {icon && (
        <span aria-hidden className="mb-3 text-ink-soft/70 [&>svg]:size-10">
          {icon}
        </span>
      )}
      <p className="font-bold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
}

/** データ取得に失敗したときの表示 */
export function ErrorState({
  title = "データを読み込めませんでした",
  description = "時間をおいて再読み込みしてください。続く場合はスタッフへ相談してください。",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4"
    >
      <IconAlert className="mt-0.5 size-5 text-danger" />
      <div>
        <p className="font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{description}</p>
      </div>
    </div>
  );
}

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

/** データ取得中のスケルトン表示 */
export function LoadingSkeleton({ lines = 3, className = "" }: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className={`animate-pulse space-y-3 ${className}`}
    >
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-4 rounded-full bg-line"
          style={{ width: `${100 - (i % 3) * 15}%` }}
        />
      ))}
    </div>
  );
}
