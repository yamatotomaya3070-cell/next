import Link from "next/link";
import { requireRole, createClient } from "@/lib/supabase/server";
import type { Task, TaskStatus } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { ErrorState } from "@/components/ui/states";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusBadge, TaskTypeBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { primaryButtonClass } from "@/components/ui/buttons";
import { IconClipboard, IconSparkles } from "@/components/ui/icons";
import { DeleteTaskButton } from "./DeleteTaskButton";

export const dynamic = "force-dynamic";

const TASK_STATUS_BADGES: Record<TaskStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "下書き", tone: "neutral" },
  published: { label: "公開中", tone: "success" },
  archived: { label: "アーカイブ", tone: "neutral" },
};

interface TaskRow {
  task: Task;
  assignedCount: number;
}

const COLUMNS: DataTableColumn<TaskRow>[] = [
  {
    key: "title",
    header: "案件名",
    render: (row) => (
      <Link
        href={`/staff/tasks/${row.task.id}`}
        className="font-bold text-ink hover:text-primary hover:underline"
      >
        {row.task.title}
      </Link>
    ),
  },
  {
    key: "type",
    header: "種別",
    render: (row) => <TaskTypeBadge type={row.task.type} size="sm" />,
  },
  {
    key: "status",
    header: "公開状態",
    render: (row) => {
      const def = TASK_STATUS_BADGES[row.task.status];
      return <StatusBadge label={def.label} tone={def.tone} size="sm" />;
    },
  },
  {
    key: "difficulty",
    header: "難易度",
    render: (row) => (
      <span aria-label={`難易度 ${row.task.difficulty} / 5`} className="text-ink">
        {"★".repeat(row.task.difficulty)}
        <span className="text-line">{"★".repeat(5 - row.task.difficulty)}</span>
      </span>
    ),
  },
  {
    key: "assigned",
    header: "配布数",
    render: (row) => <span className="text-ink">{row.assignedCount}名</span>,
  },
  {
    key: "created",
    header: "作成日",
    render: (row) => (
      <span className="text-ink-soft">
        {new Date(row.task.created_at).toLocaleDateString("ja-JP")}
      </span>
    ),
  },
  {
    key: "detail",
    header: "",
    render: (row) => (
      <Link
        href={`/staff/tasks/${row.task.id}`}
        className="inline-flex min-h-11 items-center font-bold text-primary hover:text-primary-dark hover:underline"
      >
        配布・詳細 →
      </Link>
    ),
  },
  {
    key: "delete",
    header: "",
    render: (row) => <DeleteTaskButton taskId={row.task.id} title={row.task.title} />,
  },
];

export default async function StaffTasksPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const [{ data: tasksData, error }, { data: assignmentsData }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("task_assignments").select("id, task_id"),
    ]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const tasks = (tasksData ?? []) as Task[];
  const counts = new Map<string, number>();
  for (const a of assignmentsData ?? []) {
    counts.set(a.task_id, (counts.get(a.task_id) ?? 0) + 1);
  }
  const rows: TaskRow[] = tasks.map((task) => ({
    task,
    assignedCount: counts.get(task.id) ?? 0,
  }));

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <IconClipboard className="text-primary" />
          案件管理
        </h1>
        <Link href="/staff/scene" className={primaryButtonClass}>
          <IconSparkles className="size-4" />
          YouTube動画を生成する
        </Link>
      </div>

      <div className="mt-4">
        <SectionCard flush>
          <DataTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.task.id}
            caption="案件一覧"
            emptyTitle="案件がまだありません"
            emptyDescription="「YouTube動画を生成する」から最初の案件を作成できます。"
          />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
