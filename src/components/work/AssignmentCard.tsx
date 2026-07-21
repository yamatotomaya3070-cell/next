import Link from "next/link";
import type { AssignmentStatus, TaskType } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import {
  AssignmentStatusBadge,
  TaskTypeBadge,
} from "@/components/ui/StatusBadge";
import { IconCalendar } from "@/components/ui/icons";
import { TaskThumb } from "./TaskThumb";

export interface AssignmentCardData {
  id: string;
  taskId: string;
  title: string;
  type: TaskType;
  status: AssignmentStatus;
  dueAt: string | null;
  progressPercent: number;
}

/** ステータスに応じた操作ボタンの文言（行動ベース） */
export function actionLabel(status: AssignmentStatus): string {
  switch (status) {
    case "not_started":
      return "作業を始める";
    case "in_progress":
      return "作業を再開する";
    case "submitted":
      return "提出内容を確認する";
    case "feedback":
      return "レビュー結果を見る";
    case "completed":
      return "実績を見る";
  }
}

export function formatDue(dueAt: string | null): string {
  if (!dueAt) return "納期なし";
  const date = new Date(dueAt);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekday})`;
}

/** 受注中の案件カード（就労者ホーム・受注案件一覧で使用） */
export function AssignmentCard({ data }: { data: AssignmentCardData }) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-3 shadow-card transition hover:shadow-card-hover">
      <div className="relative">
        <TaskThumb taskId={data.taskId} />
        <span className="absolute left-2 top-2">
          <TaskTypeBadge type={data.type} size="sm" />
        </span>
      </div>
      <p className="mt-3 line-clamp-2 font-bold leading-snug text-ink">
        {data.title}
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-sm text-ink-soft">
        <IconCalendar className="size-4" />
        納期 {formatDue(data.dueAt)}
      </p>
      <div className="mt-2">
        <ProgressBar percent={data.progressPercent} label="進捗" size="sm" />
      </div>
      <div className="mt-2">
        <AssignmentStatusBadge status={data.status} size="sm" />
      </div>
      <Link
        href={`/tasks/${data.id}`}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-primary/40 bg-surface px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-soft"
      >
        {actionLabel(data.status)}
      </Link>
    </div>
  );
}
