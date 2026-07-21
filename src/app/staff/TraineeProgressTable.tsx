import Link from "next/link";
import type { AssignmentStatus, TaskType } from "@/lib/types";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge, TaskTypeBadge } from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";

export interface TraineeProgressRow {
  userId: string;
  userName: string;
  currentTaskTitle: string | null;
  currentTaskType: TaskType | null;
  currentStatus: AssignmentStatus | null;
  progressPercent: number | null;
  aiScore: number | null;
  staffCheck: "pending" | "approved" | "none";
  nextAction: { label: string; href: string };
}

const STAFF_CHECK_BADGE = {
  pending: { label: "承認待ち", tone: "warning" as const },
  approved: { label: "承認済み", tone: "success" as const },
  none: { label: "未確認", tone: "neutral" as const },
};

/** AIスコア(0-5)の表示。評価が無い場合は「評価なし」 */
function aiScoreLabel(score: number | null): string {
  if (score === null) return "評価なし";
  return `${score.toFixed(1)} / 5`;
}

const COLUMNS: DataTableColumn<TraineeProgressRow>[] = [
  {
    key: "user",
    header: "利用者",
    render: (row) => (
      <Link
        href={`/staff/users/${row.userId}`}
        className="flex items-center gap-2.5 font-bold text-ink hover:text-primary hover:underline"
      >
        <UserAvatar name={row.userName} size="sm" />
        {row.userName} さん
      </Link>
    ),
  },
  {
    key: "task",
    header: "現在の案件",
    render: (row) =>
      row.currentTaskTitle ? (
        <span className="text-ink">{row.currentTaskTitle}</span>
      ) : (
        <span className="text-ink-soft">案件なし</span>
      ),
  },
  {
    key: "type",
    header: "種別",
    render: (row) =>
      row.currentTaskType ? (
        <TaskTypeBadge type={row.currentTaskType} size="sm" />
      ) : (
        <span className="text-ink-soft">-</span>
      ),
  },
  {
    key: "progress",
    header: "進捗",
    className: "min-w-32",
    render: (row) =>
      row.progressPercent !== null ? (
        <ProgressBar percent={row.progressPercent} size="sm" label="進捗" />
      ) : (
        <span className="text-ink-soft">-</span>
      ),
  },
  {
    key: "ai",
    header: "AI評価",
    render: (row) => (
      <span
        className={
          row.aiScore !== null && row.aiScore >= 4
            ? "font-bold text-success"
            : "text-ink"
        }
      >
        {aiScoreLabel(row.aiScore)}
      </span>
    ),
  },
  {
    key: "staff",
    header: "スタッフ確認",
    render: (row) => {
      const def = STAFF_CHECK_BADGE[row.staffCheck];
      return <StatusBadge label={def.label} tone={def.tone} size="sm" />;
    },
  },
  {
    key: "next",
    header: "次の対応",
    render: (row) => (
      <Link
        href={row.nextAction.href}
        className="inline-flex min-h-11 items-center font-bold text-primary hover:text-primary-dark hover:underline"
      >
        {row.nextAction.label} →
      </Link>
    ),
  },
];

/** 利用者の進行状況テーブル */
export function TraineeProgressTable({ rows }: { rows: TraineeProgressRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.userId}
      caption="利用者の進行状況"
      emptyTitle="利用者が登録されていません"
      emptyDescription="利用者アカウントを作成すると、進行状況がここに表示されます。"
    />
  );
}
