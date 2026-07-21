import Link from "next/link";
import { requireProfile, createClient } from "@/lib/supabase/server";
import type { AssignmentStatus, TaskType } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { DonutChart } from "@/components/ui/DonutChart";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { primaryButtonClass } from "@/components/ui/buttons";
import {
  AssignmentStatusBadge,
  TaskTypeBadge,
} from "@/components/ui/StatusBadge";
import {
  IconBriefcase,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconPlayCircle,
  IconRobot,
  IconTrophy,
  IconUpload,
} from "@/components/ui/icons";
import {
  AssignmentCard,
  actionLabel,
  formatDue,
  type AssignmentCardData,
} from "@/components/work/AssignmentCard";
import { TaskThumb } from "@/components/work/TaskThumb";

export const dynamic = "force-dynamic";

interface AssignmentRow {
  id: string;
  status: AssignmentStatus;
  due_at: string | null;
  completed_at: string | null;
  tasks: {
    id: string;
    title: string;
    type: TaskType;
    estimated_minutes: number | null;
  } | null;
}

/** ステータスからの進捗フォールバック（progress_logs が無い場合） */
const STATUS_PROGRESS: Record<AssignmentStatus, number> = {
  not_started: 0,
  in_progress: 40,
  submitted: 80,
  feedback: 90,
  completed: 100,
};

const HERO_PRIORITY: AssignmentStatus[] = [
  "in_progress",
  "feedback",
  "not_started",
  "submitted",
];

function formatMinutes(minutes: number | null): string {
  if (!minutes) return "目安時間なし";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `約${m}分`;
  return m === 0 ? `約${h}時間` : `約${h}時間${m}分`;
}

function isDueSoon(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const diff = new Date(dueAt).getTime() - Date.now();
  return diff < 1000 * 60 * 60 * 48;
}

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data, error }, { data: logsData }] = await Promise.all([
    supabase
      .from("task_assignments")
      .select(
        "id, status, due_at, completed_at, tasks(id, title, type, estimated_minutes)",
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("progress_logs")
      .select("assignment_id, progress_percent, created_at")
      .eq("user_id", profile.id)
      .not("progress_percent", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const assignments = (data ?? []) as unknown as AssignmentRow[];

  // 案件ごとの最新の進捗率（progress_logs 優先、なければステータスから推定）
  const latestProgress = new Map<string, number>();
  for (const log of logsData ?? []) {
    if (!latestProgress.has(log.assignment_id)) {
      latestProgress.set(log.assignment_id, log.progress_percent as number);
    }
  }
  const progressOf = (a: AssignmentRow): number =>
    a.status === "completed"
      ? 100
      : (latestProgress.get(a.id) ?? STATUS_PROGRESS[a.status]);

  const active = assignments.filter((a) => a.status !== "completed");
  const done = assignments.filter((a) => a.status === "completed");

  // 今日の作業: 進行優先度 → 納期が近い順
  const hero = [...active].sort((a, b) => {
    const p = HERO_PRIORITY.indexOf(a.status) - HERO_PRIORITY.indexOf(b.status);
    if (p !== 0) return p;
    return (
      (a.due_at ? new Date(a.due_at).getTime() : Infinity) -
      (b.due_at ? new Date(b.due_at).getTime() : Infinity)
    );
  })[0];

  // 作業サポートAIからのアドバイス（承認済みフィードバックの改善ポイントを再利用）
  let advice: string[] = [];
  if (assignments.length > 0) {
    const { data: fbData } = await supabase
      .from("feedback")
      .select("improve_points, submissions!inner(assignment_id)")
      .in(
        "submissions.assignment_id",
        assignments.map((a) => a.id),
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1);
    advice = (fbData?.[0]?.improve_points ?? []).slice(0, 2);
  }

  const cardData = (a: AssignmentRow): AssignmentCardData => ({
    id: a.id,
    taskId: a.tasks?.id ?? a.id,
    title: a.tasks?.title ?? "（案件名なし）",
    type: a.tasks?.type ?? "practice",
    status: a.status,
    dueAt: a.due_at,
    progressPercent: progressOf(a),
  });

  const dueSoon = active.filter((a) => isDueSoon(a.due_at));
  const overallPercent =
    assignments.length === 0 ? 0 : (done.length / assignments.length) * 100;

  const aside = (
    <>
      <SectionCard title="本日の予定" icon={<IconCalendar />}>
        {dueSoon.length === 0 ? (
          <p className="text-sm text-ink-soft">
            納期が近い案件はありません。自分のペースで進めましょう。
          </p>
        ) : (
          <ul className="space-y-3">
            {dueSoon.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 rounded-lg bg-warning-soft px-2 py-0.5 text-xs font-bold text-amber-700">
                  {formatDue(a.due_at)}
                </span>
                <Link
                  href={`/tasks/${a.id}`}
                  className="min-w-0 text-sm font-medium text-ink hover:text-primary hover:underline"
                >
                  {a.tasks?.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
          休憩リマインダー: {profile.break_interval_minutes}分ごと
        </p>
      </SectionCard>

      <SectionCard title="進行状況" icon={<IconClock />}>
        <div className="flex items-center gap-4">
          <DonutChart percent={overallPercent} label="全体の進捗" size={110} />
          <div className="text-sm text-ink-soft">
            <p className="font-bold text-ink">全体の進捗</p>
            <p className="mt-1">
              完了 {done.length}件 / 全{assignments.length}件
            </p>
            <p>進行中 {active.length}件</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="作業サポートAIからのアドバイス" icon={<IconRobot />}>
        {advice.length > 0 ? (
          <ul className="space-y-2">
            {advice.map((tip) => (
              <li
                key={tip}
                className="rounded-xl bg-primary-soft/60 p-3 text-sm leading-relaxed text-ink"
              >
                {tip}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-primary-soft/60 p-3 text-sm leading-relaxed text-ink">
            提出するとレビュー結果に合わせたアドバイスが届きます。まずは一歩ずつ進めてみましょう。
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="最近の実績"
        icon={<IconTrophy />}
        action={
          done.length > 0
            ? { label: "すべて見る", href: "/works?status=completed" }
            : undefined
        }
      >
        {done.length === 0 ? (
          <p className="text-sm text-ink-soft">
            完了した案件がここに表示されます。
          </p>
        ) : (
          <ul className="space-y-2.5">
            {done.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-sm">
                <IconCheckCircle className="mt-0.5 size-4 text-success" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">
                    {a.tasks?.title}
                  </span>
                  {a.completed_at && (
                    <span className="text-xs text-ink-soft">
                      {new Date(a.completed_at).toLocaleDateString("ja-JP")}{" "}
                      納品完了
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );

  return (
    <PageContainer aside={aside}>
      <h1 className="sr-only">ホーム</h1>

      {/* 今日の作業 */}
      <section
        aria-labelledby="today-heading"
        className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft to-surface p-6 shadow-card"
      >
        <h2
          id="today-heading"
          className="flex items-center gap-2 text-lg font-bold text-ink"
        >
          <IconPlayCircle className="text-primary" />
          今日の作業
        </h2>
        {!hero ? (
          <div className="mt-4">
            <EmptyState
              icon={<IconBriefcase />}
              title="いま取り組む案件はありません"
              description="新しい案件が届くまでお待ちください。届いたらここに表示されます。"
            />
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-col gap-5 sm:flex-row">
              <TaskThumb
                taskId={hero.tasks?.id ?? hero.id}
                size="lg"
                className="sm:w-64 sm:shrink-0"
              />
              <div className="min-w-0 flex-1">
                <TaskTypeBadge type={hero.tasks?.type ?? "practice"} />
                <p className="mt-2 text-2xl font-bold leading-snug text-ink">
                  {hero.tasks?.title}
                </p>
                <dl className="mt-3 space-y-1.5 text-[15px] text-ink-soft">
                  <div className="flex items-center gap-2">
                    <dt className="flex items-center gap-1">
                      <IconCalendar className="size-4" />
                      納期
                    </dt>
                    <dd
                      className={
                        isDueSoon(hero.due_at) ? "font-bold text-danger" : ""
                      }
                    >
                      {formatDue(hero.due_at)}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="flex items-center gap-1">
                      <IconClock className="size-4" />
                      想定作業時間
                    </dt>
                    <dd>{formatMinutes(hero.tasks?.estimated_minutes ?? null)}</dd>
                  </div>
                </dl>
                <div className="mt-3 max-w-md">
                  <ProgressBar percent={progressOf(hero)} label="進捗状況" />
                </div>
              </div>
            </div>
            <Link
              href={`/tasks/${hero.id}`}
              className={`${primaryButtonClass} mt-5 w-full text-base`}
            >
              <IconPlayCircle className="size-5" />
              {actionLabel(hero.status)}
            </Link>
          </div>
        )}
      </section>

      {/* 受注中の案件 */}
      <section aria-labelledby="active-heading" className="mt-8">
        <div className="flex items-center justify-between">
          <h2
            id="active-heading"
            className="flex items-center gap-2 text-lg font-bold text-ink"
          >
            <IconBriefcase className="text-primary" />
            受注中の案件
          </h2>
          <Link
            href="/works"
            className="flex min-h-11 items-center text-sm font-medium text-primary hover:text-primary-dark hover:underline"
          >
            すべて見る →
          </Link>
        </div>
        {active.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<IconBriefcase />}
              title="受注中の案件はありません"
              description="新しい案件が配布されるとここに表示されます。"
            />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {active.map((a) => (
              <AssignmentCard key={a.id} data={cardData(a)} />
            ))}
          </div>
        )}
      </section>

      {/* 提出・レビュー状況 */}
      <section aria-labelledby="review-heading" className="mt-8">
        <h2
          id="review-heading"
          className="flex items-center gap-2 text-lg font-bold text-ink"
        >
          <IconUpload className="text-primary" />
          提出・レビュー状況
        </h2>
        {assignments.filter((a) => a.status !== "not_started" && a.status !== "in_progress").length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="まだ提出した案件はありません"
              description="案件を提出すると、レビューの状況がここに表示されます。"
            />
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <ul className="divide-y divide-line">
              {assignments
                .filter(
                  (a) =>
                    a.status === "submitted" ||
                    a.status === "feedback" ||
                    a.status === "completed",
                )
                .slice(0, 5)
                .map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/tasks/${a.id}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-page/60"
                    >
                      <AssignmentStatusBadge status={a.status} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {a.tasks?.title}
                      </span>
                      <TaskTypeBadge
                        type={a.tasks?.type ?? "practice"}
                        size="sm"
                      />
                      <span className="text-sm text-primary">詳しく見る →</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
