import { requireProfile, createClient } from "@/lib/supabase/server";
import type { AssignmentStatus, TaskType } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconBriefcase } from "@/components/ui/icons";
import {
  AssignmentCard,
  type AssignmentCardData,
} from "@/components/work/AssignmentCard";
import { WorksFilter } from "./WorksFilter";

export const dynamic = "force-dynamic";

interface AssignmentRow {
  id: string;
  status: AssignmentStatus;
  due_at: string | null;
  tasks: { id: string; title: string; type: TaskType } | null;
}

const STATUS_PROGRESS: Record<AssignmentStatus, number> = {
  not_started: 0,
  in_progress: 40,
  submitted: 80,
  feedback: 90,
  completed: 100,
};

const FILTER_TITLES: Record<string, string> = {
  all: "受注案件",
  in_progress: "作業中の案件",
  submitted: "提出した案件（レビュー待ち）",
  feedback: "修正依頼・レビュー結果",
  completed: "実績（完了した案件）",
};

const VALID_STATUSES: AssignmentStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "feedback",
  "completed",
];

/** 状態ごとの件数（すべての状態に 0 を入れておく） */
function countByStatus(
  statuses: AssignmentStatus[],
): Record<AssignmentStatus, number> {
  const counts = Object.fromEntries(
    VALID_STATUSES.map((s) => [s, 0]),
  ) as Record<AssignmentStatus, number>;
  for (const s of statuses) {
    if (s in counts) counts[s] += 1;
  }
  return counts;
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const filter = VALID_STATUSES.includes(status as AssignmentStatus)
    ? (status as AssignmentStatus)
    : null;

  let query = supabase
    .from("task_assignments")
    .select("id, status, due_at, tasks(id, title, type)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  if (filter) query = query.eq("status", filter);

  const [{ data, error }, { data: logsData }, { data: statusRows }] =
    await Promise.all([
    query,
    supabase
      .from("progress_logs")
      .select("assignment_id, progress_percent, created_at")
      .eq("user_id", profile.id)
      .not("progress_percent", "is", null)
      .order("created_at", { ascending: false }),
    // 絞り込みチップに出す状態ごとの件数（絞り込みに関係なく全件から数える）
    supabase
      .from("task_assignments")
      .select("status")
      .eq("user_id", profile.id),
  ]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const assignments = (data ?? []) as unknown as AssignmentRow[];
  const counts = countByStatus(
    ((statusRows ?? []) as { status: AssignmentStatus }[]).map((r) => r.status),
  );
  const latestProgress = new Map<string, number>();
  for (const log of logsData ?? []) {
    if (!latestProgress.has(log.assignment_id)) {
      latestProgress.set(log.assignment_id, log.progress_percent as number);
    }
  }

  const cards: AssignmentCardData[] = assignments.map((a) => ({
    id: a.id,
    taskId: a.tasks?.id ?? a.id,
    title: a.tasks?.title ?? "（案件名なし）",
    type: a.tasks?.type ?? "practice",
    status: a.status,
    dueAt: a.due_at,
    progressPercent:
      a.status === "completed"
        ? 100
        : (latestProgress.get(a.id) ?? STATUS_PROGRESS[a.status]),
  }));

  return (
    <PageContainer>
      <h1 className="text-xl font-bold text-ink">
        {FILTER_TITLES[filter ?? "all"]}
      </h1>
      <div className="mt-4">
        <WorksFilter current={filter} counts={counts} />
      </div>
      {cards.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconBriefcase />}
            title="該当する案件はありません"
            description="条件を変えるか、新しい案件が届くのをお待ちください。"
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {cards.map((card) => (
            <AssignmentCard key={card.id} data={card} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
