import Link from "next/link";
import { requireRole, createClient } from "@/lib/supabase/server";
import type { AssignmentStatus, Profile, TaskType } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { ErrorState } from "@/components/ui/states";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  AssignmentStatusBadge,
  TaskTypeBadge,
} from "@/components/ui/StatusBadge";
import { IconUsers } from "@/components/ui/icons";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface AssignmentRow {
  id: string;
  status: AssignmentStatus;
  user_id: string;
  tasks: { title: string; type: TaskType } | null;
}

interface UserRow {
  profile: Profile;
  current: AssignmentRow | null;
  activeCount: number;
  completedCount: number;
}

const COLUMNS: DataTableColumn<UserRow>[] = [
  {
    key: "user",
    header: "利用者",
    render: (row) => (
      <span className="flex items-center gap-2.5 font-bold text-ink">
        <UserAvatar name={row.profile.display_name} size="sm" />
        {row.profile.display_name} さん
      </span>
    ),
  },
  {
    key: "current",
    header: "現在の案件",
    render: (row) =>
      row.current ? (
        <span className="text-ink">{row.current.tasks?.title}</span>
      ) : (
        <span className="text-ink-soft">案件なし</span>
      ),
  },
  {
    key: "type",
    header: "種別",
    render: (row) =>
      row.current?.tasks ? (
        <TaskTypeBadge type={row.current.tasks.type} size="sm" />
      ) : (
        <span className="text-ink-soft">-</span>
      ),
  },
  {
    key: "status",
    header: "状態",
    render: (row) =>
      row.current ? (
        <AssignmentStatusBadge status={row.current.status} size="sm" />
      ) : (
        <span className="text-ink-soft">-</span>
      ),
  },
  {
    key: "counts",
    header: "進行中 / 完了",
    render: (row) => (
      <span className="text-ink">
        {row.activeCount}件 / {row.completedCount}件
      </span>
    ),
  },
  {
    key: "detail",
    header: "",
    render: (row) => (
      <Link
        href={`/staff/users/${row.profile.id}`}
        className="inline-flex min-h-11 items-center font-bold text-primary hover:text-primary-dark hover:underline"
      >
        詳細を見る →
      </Link>
    ),
  },
];

export default async function StaffUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const [{ data: traineesData, error }, { data: assignmentsData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "trainee")
        .order("display_name"),
      supabase
        .from("task_assignments")
        .select("id, status, user_id, tasks(title, type)")
        .order("created_at", { ascending: false }),
    ]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const keyword = (q ?? "").trim();
  const trainees = ((traineesData ?? []) as Profile[]).filter(
    (t) =>
      !keyword ||
      t.display_name.includes(keyword) ||
      (t.display_name_kana ?? "").includes(keyword),
  );
  const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];

  const rows: UserRow[] = trainees.map((t) => {
    const theirs = assignments.filter((a) => a.user_id === t.id);
    const activeList = theirs.filter((a) => a.status !== "completed");
    return {
      profile: t,
      current: activeList[0] ?? null,
      activeCount: activeList.length,
      completedCount: theirs.length - activeList.length,
    };
  });

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <IconUsers className="text-primary" />
          利用者一覧
        </h1>
        <div className="w-full max-w-xs">
          <Suspense fallback={null}>
            <SearchInput placeholder="利用者名で検索" label="利用者を検索" />
          </Suspense>
        </div>
      </div>

      <div className="mt-4">
        <SectionCard flush>
          <DataTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.profile.id}
            caption="利用者一覧"
            emptyTitle={
              keyword
                ? `「${keyword}」に一致する利用者は見つかりませんでした`
                : "利用者が登録されていません"
            }
            emptyDescription={
              keyword
                ? "別のキーワードで検索してください。"
                : "Supabase の Authentication で利用者アカウントを作成してください。"
            }
          />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
