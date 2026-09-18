import type { AssignmentStatus, TaskType } from "@/lib/types";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "teal";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-page text-ink-soft border-line",
  info: "bg-primary-soft text-primary-dark border-primary/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-amber-700 border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/20",
  purple: "bg-accent-purple-soft text-accent-purple border-accent-purple/20",
  teal: "bg-teal-soft text-teal border-teal/20",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-ink-soft",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  purple: "bg-accent-purple",
  teal: "bg-teal",
};

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  size?: "sm" | "md";
}

/**
 * 状態バッジ。色だけに頼らず必ず文字ラベル+ドットで状態を伝える。
 */
export function StatusBadge({
  label,
  tone = "neutral",
  size = "md",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-bold ${TONE_CLASSES[tone]} ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {label}
    </span>
  );
}

/** 案件の進行ステータス → バッジ表示定義 */
export const ASSIGNMENT_BADGES: Record<
  AssignmentStatus,
  { label: string; tone: BadgeTone }
> = {
  not_started: { label: "未着手", tone: "neutral" },
  in_progress: { label: "作業中", tone: "info" },
  submitted: { label: "レビュー待ち", tone: "warning" },
  feedback: { label: "やり直し依頼中", tone: "purple" },
  completed: { label: "完了", tone: "success" },
};

/** 案件種別 → バッジ表示定義（練習案件も価値が低く見えないトーンにする） */
export const TASK_TYPE_BADGES: Record<
  TaskType,
  { label: string; tone: BadgeTone }
> = {
  practice: { label: "練習案件", tone: "info" },
  real: { label: "本番案件", tone: "teal" },
};

export function AssignmentStatusBadge({
  status,
  size,
}: {
  status: AssignmentStatus;
  size?: "sm" | "md";
}) {
  const def = ASSIGNMENT_BADGES[status];
  return <StatusBadge label={def.label} tone={def.tone} size={size} />;
}

export function TaskTypeBadge({
  type,
  size,
}: {
  type: TaskType;
  size?: "sm" | "md";
}) {
  const def = TASK_TYPE_BADGES[type];
  return <StatusBadge label={def.label} tone={def.tone} size={size} />;
}
