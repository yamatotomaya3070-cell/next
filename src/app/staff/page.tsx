import Link from "next/link";
import { requireRole, createClient } from "@/lib/supabase/server";
import type {
  AssignmentStatus,
  Profile,
  QaLog,
  TaskType,
} from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DonutChart } from "@/components/ui/DonutChart";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/buttons";
import {
  IconAlert,
  IconBriefcase,
  IconCheckSquare,
  IconClipboard,
  IconGlobe,
  IconHome,
  IconRobot,
  IconSparkles,
  IconUpload,
  IconUsers,
} from "@/components/ui/icons";
import { AnswerForm } from "./AnswerForm";
import {
  TraineeProgressTable,
  type TraineeProgressRow,
} from "./TraineeProgressTable";
import { ExportReportButton, type ReportRow } from "./ExportReportButton";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AssignmentRow {
  id: string;
  status: AssignmentStatus;
  due_at: string | null;
  completed_at: string | null;
  user_id: string;
  created_at: string;
  tasks: { id: string; title: string; type: TaskType } | null;
}

interface SubmissionRow {
  id: string;
  assignment_id: string;
  version: number;
  submitted_at: string;
}

interface FeedbackRow {
  submission_id: string;
  score: number | null;
  improve_points: string[] | null;
  status: string;
}

const STATUS_PROGRESS: Record<AssignmentStatus, number> = {
  not_started: 0,
  in_progress: 40,
  submitted: 80,
  feedback: 90,
  completed: 100,
};

function isOverdue(dueAt: string | null): boolean {
  return Boolean(dueAt && new Date(dueAt).getTime() < Date.now());
}

/** 本番移行判定（表示用の目安。最終承認は必ずスタッフが行う） */
export type TransferState =
  | "本番対応中"
  | "移行候補"
  | "要フォロー"
  | "練習継続";

const TRANSFER_TONE = {
  本番対応中: "teal",
  移行候補: "success",
  要フォロー: "warning",
  練習継続: "neutral",
} as const;

export default async function StaffDashboardPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const [
    { data: traineesData, error: traineesError },
    { data: assignmentsData, error: assignmentsError },
    { count: pendingCount },
    { data: questionsData },
    { data: submissionsData },
    { data: approvedFbData },
    { data: pendingFbData },
    { data: logsData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "trainee")
      .order("display_name"),
    supabase
      .from("task_assignments")
      .select(
        "id, status, due_at, completed_at, user_id, created_at, tasks(id, title, type)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("qa_logs")
      .select("*")
      .eq("needs_staff", true)
      .is("answer", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("submissions")
      .select("id, assignment_id, version, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(300),
    supabase
      .from("feedback")
      .select("submission_id, score, improve_points, status")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("feedback")
      .select("submission_id, score, improve_points, status")
      .eq("status", "pending_review")
      .limit(100),
    supabase
      .from("progress_logs")
      .select("assignment_id, progress_percent, created_at")
      .not("progress_percent", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (traineesError || assignmentsError) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const trainees = (traineesData ?? []) as Profile[];
  const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];
  const questions = (questionsData ?? []) as QaLog[];
  const submissions = (submissionsData ?? []) as SubmissionRow[];
  const approvedFb = (approvedFbData ?? []) as FeedbackRow[];
  const pendingFb = (pendingFbData ?? []) as FeedbackRow[];

  // 各種マッピング
  const submissionToAssignment = new Map(
    submissions.map((s) => [s.id, s.assignment_id]),
  );
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));
  const userOfSubmission = (submissionId: string): string | null => {
    const aid = submissionToAssignment.get(submissionId);
    return aid ? (assignmentById.get(aid)?.user_id ?? null) : null;
  };

  const latestProgress = new Map<string, number>();
  for (const log of logsData ?? []) {
    if (!latestProgress.has(log.assignment_id)) {
      latestProgress.set(log.assignment_id, log.progress_percent as number);
    }
  }

  // 利用者ごとの集計
  const usersWithPendingFb = new Set(
    pendingFb.map((f) => userOfSubmission(f.submission_id)).filter(Boolean),
  );
  const scoresByUser = new Map<string, number[]>();
  for (const fb of approvedFb) {
    if (fb.score === null) continue;
    const uid = userOfSubmission(fb.submission_id);
    if (!uid) continue;
    const list = scoresByUser.get(uid) ?? [];
    list.push(fb.score);
    scoresByUser.set(uid, list);
  }
  const avgScore = (uid: string): number | null => {
    const list = scoresByUser.get(uid);
    if (!list || list.length === 0) return null;
    return list.reduce((sum, s) => sum + s, 0) / list.length;
  };

  const active = assignments.filter((a) => a.status !== "completed");
  const activeByUser = new Map<string, AssignmentRow[]>();
  for (const a of active) {
    const list = activeByUser.get(a.user_id) ?? [];
    list.push(a);
    activeByUser.set(a.user_id, list);
  }

  const revisionCount = (uid: string): number => {
    const theirIds = new Set(
      assignments.filter((a) => a.user_id === uid).map((a) => a.id),
    );
    const maxVersion = new Map<string, number>();
    for (const s of submissions) {
      if (!theirIds.has(s.assignment_id)) continue;
      maxVersion.set(
        s.assignment_id,
        Math.max(maxVersion.get(s.assignment_id) ?? 0, s.version),
      );
    }
    let total = 0;
    for (const v of maxVersion.values()) total += Math.max(0, v - 1);
    return total;
  };

  const onTimeRate = (uid: string): number | null => {
    const doneWithDue = assignments.filter(
      (a) => a.user_id === uid && a.status === "completed" && a.due_at,
    );
    if (doneWithDue.length === 0) return null;
    const onTime = doneWithDue.filter(
      (a) =>
        a.completed_at &&
        new Date(a.completed_at).getTime() <= new Date(a.due_at!).getTime(),
    );
    return onTime.length / doneWithDue.length;
  };

  const transferState = (uid: string): TransferState => {
    const theirActive = activeByUser.get(uid) ?? [];
    if (theirActive.some((a) => a.tasks?.type === "real")) return "本番対応中";
    const score = avgScore(uid);
    const completedCount = assignments.filter(
      (a) => a.user_id === uid && a.status === "completed",
    ).length;
    const hasOverdue = theirActive.some((a) => isOverdue(a.due_at));
    if (hasOverdue || (score !== null && score < 3)) return "要フォロー";
    if (score !== null && score >= 4 && completedCount >= 2) return "移行候補";
    return "練習継続";
  };

  // 進行状況テーブルの行データ
  const progressRows: TraineeProgressRow[] = trainees.map((t) => {
    const theirActive = activeByUser.get(t.id) ?? [];
    const current = theirActive[0] ?? null;
    const hasPending = usersWithPendingFb.has(t.id);

    let nextAction: TraineeProgressRow["nextAction"];
    if (hasPending) {
      nextAction = { label: "レビューを承認", href: "/staff/reviews" };
    } else if (current?.status === "submitted") {
      nextAction = {
        label: "提出を確認",
        href: current.tasks ? `/staff/tasks/${current.tasks.id}` : "/staff/reviews",
      };
    } else if (current && isOverdue(current.due_at)) {
      nextAction = { label: "進捗を確認", href: `/staff/users/${t.id}` };
    } else if (current?.status === "feedback") {
      nextAction = { label: "修正対応を確認", href: `/staff/users/${t.id}` };
    } else if (!current) {
      nextAction = { label: "次の案件を配布", href: "/staff/tasks" };
    } else {
      nextAction = { label: "進捗を確認", href: `/staff/users/${t.id}` };
    }

    return {
      userId: t.id,
      userName: t.display_name,
      currentTaskTitle: current?.tasks?.title ?? null,
      currentTaskType: current?.tasks?.type ?? null,
      currentStatus: current?.status ?? null,
      progressPercent: current
        ? (latestProgress.get(current.id) ?? STATUS_PROGRESS[current.status])
        : null,
      aiScore: avgScore(t.id),
      staffCheck: hasPending
        ? "pending"
        : scoresByUser.has(t.id)
          ? "approved"
          : "none",
      nextAction,
    };
  });

  // CSVレポート用の行データ（進行状況テーブル＋移行判定・実績を集計）
  const TASK_TYPE_LABEL: Record<TaskType, string> = {
    practice: "練習案件",
    real: "本番案件",
  };
  const STAFF_CHECK_LABEL = {
    pending: "承認待ち",
    approved: "承認済み",
    none: "未確認",
  } as const;
  const reportRows: ReportRow[] = progressRows.map((row) => {
    const completedCount = assignments.filter(
      (a) => a.user_id === row.userId && a.status === "completed",
    ).length;
    return {
      userName: row.userName,
      transferState: transferState(row.userId),
      currentTaskTitle: row.currentTaskTitle ?? "案件なし",
      currentTaskType: row.currentTaskType
        ? TASK_TYPE_LABEL[row.currentTaskType]
        : "-",
      currentStatus: row.currentStatus
        ? ASSIGNMENT_STATUS_LABELS[row.currentStatus].label
        : "-",
      progressPercent: row.progressPercent,
      aiScore: row.aiScore,
      completedCount,
      revisionCount: revisionCount(row.userId),
      onTimeRate: onTimeRate(row.userId),
      staffCheck: STAFF_CHECK_LABEL[row.staffCheck],
    };
  });

  // KPI
  const workingTrainees = trainees.filter(
    (t) => (activeByUser.get(t.id) ?? []).length > 0,
  ).length;
  const practiceActive = active.filter(
    (a) => a.tasks?.type === "practice",
  ).length;
  const realActive = active.filter((a) => a.tasks?.type === "real").length;
  const candidates = trainees.filter(
    (t) => transferState(t.id) === "移行候補",
  ).length;
  const submittedCount = active.filter((a) => a.status === "submitted").length;

  // 配布・回収状況
  const total = assignments.length;
  const distribution = [
    { label: "配布済み", count: total, tone: "info" as const },
    { label: "提出済み", count: submittedCount, tone: "teal" as const },
    {
      label: "修正依頼中",
      count: active.filter((a) => a.status === "feedback").length,
      tone: "warning" as const,
    },
    {
      label: "完了",
      count: assignments.filter((a) => a.status === "completed").length,
      tone: "success" as const,
    },
  ];

  // AI添削サマリー（承認済みフィードバックの改善指摘を集計）
  const pointCounts = new Map<string, number>();
  for (const fb of approvedFb) {
    for (const point of fb.improve_points ?? []) {
      pointCounts.set(point, (pointCounts.get(point) ?? 0) + 1);
    }
  }
  const topPoints = [...pointCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxPointCount = topPoints[0]?.[1] ?? 1;

  // 右パネル用データ
  const today = new Date();
  const isDueToday = (dueAt: string | null): boolean => {
    if (!dueAt) return false;
    const d = new Date(dueAt);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };
  const notSubmittedToday = active.filter(
    (a) =>
      (isDueToday(a.due_at) || isOverdue(a.due_at)) &&
      (a.status === "not_started" || a.status === "in_progress"),
  );
  const waitingReview = active.filter((a) => a.status === "submitted");
  const traineeName = (id: string) =>
    trainees.find((t) => t.id === id)?.display_name ?? "不明";

  const questionTaskTitle = (assignmentId: string | null): string | null =>
    assignmentId ? (assignmentById.get(assignmentId)?.tasks?.title ?? null) : null;

  const aside = (
    <>
      <SectionCard title="本日の未提出" icon={<IconAlert />}>
        {notSubmittedToday.length === 0 ? (
          <p className="text-sm text-ink-soft">
            本日納期で未提出の案件はありません。
          </p>
        ) : (
          <ul className="space-y-3">
            {notSubmittedToday.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 text-sm">
                <UserAvatar name={traineeName(a.user_id)} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">
                    {traineeName(a.user_id)} さん
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {a.tasks?.title}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-danger">
                  {isOverdue(a.due_at) ? "期限超過" : "本日期限"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="レビュー待ち案件"
        icon={<IconUpload />}
        action={{ label: "すべて見る", href: "/staff/reviews" }}
      >
        {waitingReview.length === 0 ? (
          <p className="text-sm text-ink-soft">レビュー待ちはありません。</p>
        ) : (
          <ul className="space-y-3">
            {waitingReview.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 text-sm">
                <UserAvatar name={traineeName(a.user_id)} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">
                    {traineeName(a.user_id)} さん
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {a.tasks?.title}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="新着CrowdWorks案件" icon={<IconGlobe />}>
        <p className="text-sm text-ink-soft">
          CrowdWorks案件の自動取り込みは準備中です。実案件はスタッフが登録できます。
        </p>
        <Link
          href="/staff/cases/new"
          className={`${secondaryButtonClass} mt-3 w-full text-sm`}
        >
          実案件を登録する
        </Link>
      </SectionCard>

      <SectionCard title="クイックアクション">
        <div className="grid grid-cols-1 gap-2.5">
          <Link href="/staff/tasks" className={`${primaryButtonClass} w-full text-sm`}>
            <IconBriefcase className="size-4" />
            案件を配布する
          </Link>
          <Link
            href="/staff/scene"
            className={`${secondaryButtonClass} w-full text-sm`}
          >
            <IconSparkles className="size-4" />
            YouTube動画を生成する
          </Link>
          <Link
            href="/staff/users/new"
            className={`${secondaryButtonClass} w-full text-sm`}
          >
            <IconUsers className="size-4" />
            利用者・職員を追加する
          </Link>
          <ExportReportButton rows={reportRows} />
        </div>
      </SectionCard>
    </>
  );

  return (
    <PageContainer aside={aside}>
      <h1 className="sr-only">スタッフダッシュボード</h1>

      {/* KPIカード */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
        <MetricCard
          icon={<IconUsers />}
          label="稼働中の利用者"
          value={`${workingTrainees}名`}
          sub={`登録 ${trainees.length}名`}
          tone="info"
        />
        <MetricCard
          icon={<IconSparkles />}
          label="模擬案件対応中"
          value={`${practiceActive}件`}
          tone="purple"
        />
        <MetricCard
          icon={<IconBriefcase />}
          label="本番案件対応中"
          value={`${realActive}件`}
          tone="teal"
        />
        <MetricCard
          icon={<IconHome />}
          label="本番移行候補"
          value={`${candidates}名`}
          tone="warning"
        />
        <MetricCard
          icon={<IconCheckSquare />}
          label="レビュー待ち"
          value={`${submittedCount + (pendingCount ?? 0)}件`}
          sub={`AI添削の承認待ち ${pendingCount ?? 0}件`}
          tone="danger"
        />
      </div>

      {/* 利用者の進行状況 */}
      <div className="mt-6">
        <SectionCard
          title="利用者の進行状況"
          icon={<IconUsers />}
          action={{ label: "すべて見る", href: "/staff/users" }}
          flush
        >
          <TraineeProgressTable rows={progressRows} />
        </SectionCard>
      </div>

      {/* 未回答の質問（既存機能） */}
      {questions.length > 0 && (
        <div className="mt-6">
          <SectionCard title="未回答の質問" icon={<IconRobot />}>
            <div className="space-y-4">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-line bg-page/50 p-4"
                >
                  <p className="text-xs text-ink-soft">
                    {traineeName(q.user_id)} さん ・{" "}
                    {new Date(q.created_at).toLocaleString("ja-JP")}
                  </p>
                  {questionTaskTitle(q.assignment_id) ? (
                    <p className="mt-1 text-xs font-medium text-primary-dark">
                      案件: {questionTaskTitle(q.assignment_id)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-soft">
                      案件に関係しない質問
                    </p>
                  )}
                  <p className="mt-1 font-bold text-ink">{q.question}</p>
                  <div className="mt-3">
                    <AnswerForm qaId={q.id} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right">
              <Link
                href="/staff/messages"
                className="font-bold text-primary hover:text-primary-dark hover:underline"
              >
                メッセージをすべて見る →
              </Link>
            </div>
          </SectionCard>
        </div>
      )}

      {/* 配布・回収状況 */}
      <div className="mt-6">
        <SectionCard title="案件配布・回収状況" icon={<IconClipboard />}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {distribution.map((d) => (
              <div
                key={d.label}
                className="flex flex-col items-center rounded-xl border border-line p-4"
              >
                <DonutChart
                  percent={total === 0 ? 0 : (d.count / total) * 100}
                  size={84}
                  label={d.label}
                />
                <p className="mt-2 text-sm text-ink-soft">{d.label}</p>
                <p className="text-xl font-bold text-ink">{d.count}件</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {/* 本番移行判定 */}
        <SectionCard title="本番移行判定" icon={<IconHome />} flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="sr-only">本番移行判定の一覧</caption>
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    利用者
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    納期遵守
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    修正回数
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    AI評価
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    判定
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {trainees.slice(0, 6).map((t) => {
                  const rate = onTimeRate(t.id);
                  const score = avgScore(t.id);
                  const state = transferState(t.id);
                  return (
                    <tr key={t.id} className="hover:bg-page/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/staff/users/${t.id}`}
                          className="font-bold text-ink hover:text-primary hover:underline"
                        >
                          {t.display_name} さん
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {rate === null ? "実績なし" : `${Math.round(rate * 100)}%`}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {revisionCount(t.id)}回
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {score === null ? "評価なし" : `${score.toFixed(1)} / 5`}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={state}
                          tone={TRANSFER_TONE[state]}
                          size="sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-4 pt-2 text-xs text-ink-soft">
            判定は直近の実績から算出した目安です。本番案件への移行はスタッフが最終承認します（自動では移行しません）。
          </p>
        </SectionCard>

        {/* AI添削サマリー */}
        <SectionCard title="AI添削サマリー" icon={<IconRobot />}>
          {topPoints.length === 0 ? (
            <EmptyState
              title="集計できる添削データがまだありません"
              description="AI添削を承認すると、よくある指摘がここに集計されます。"
            />
          ) : (
            <ul className="space-y-3">
              {topPoints.map(([point, count]) => (
                <li key={point}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium text-ink">
                      {point}
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">
                      指摘 {count}件
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${(count / maxPointCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
