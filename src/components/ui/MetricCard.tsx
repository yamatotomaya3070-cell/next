import type { ReactNode } from "react";
import type { BadgeTone } from "./StatusBadge";

const ICON_TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-page text-ink-soft",
  info: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  purple: "bg-accent-purple-soft text-accent-purple",
  teal: "bg-teal-soft text-teal",
};

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: BadgeTone;
}

/** KPI表示用カード（管理者ダッシュボード上部など） */
export function MetricCard({
  icon,
  label,
  value,
  sub,
  tone = "info",
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-11 items-center justify-center rounded-xl ${ICON_TONE_CLASSES[tone]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-soft">{label}</p>
          <p className="text-2xl font-bold leading-tight text-ink">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}
