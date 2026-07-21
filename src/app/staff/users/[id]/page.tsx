import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, createClient } from "@/lib/supabase/server";
import {
  APTITUDE_LABELS,
  type AptitudeKey,
  type AssignmentStatus,
  type Profile,
  type TaskType,
  type UserAptitude,
} from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  AssignmentStatusBadge,
  StatusBadge,
  TaskTypeBadge,
  type BadgeTone,
} from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { EmptyState } from "@/components/ui/states";
import {
  IconChevronLeft,
  IconClipboard,
  IconHome,
  IconStar,
  IconUsers,
} from "@/components/ui/icons";
import { AptitudeForm } from "./AptitudeForm";

export const dynamic = "force-dynamic";

interface AssignmentRow {
  id: string;
  status: AssignmentStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  tasks: { title: string; type: TaskType } | null;
}

type TransferState = "本番対応中" | "移行候補" | "要フォロー" | "練習継続";

function isOverdue(dueAt: string | null): boolean {
  return Boolean(dueAt && new Date(dueAt).getTime() < Date.now());
}

const TRANSFER_TONE: Record<TransferState, BadgeTone> = {
  本番対応中: "teal",
  移行候補: "success",
  要フォロー: "warning",
  練習継続: "neutral",
};

export default async function StaffUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const [
    { data: profileData },
    { data: aptitudesData },
    { data: assignmentsData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("user_aptitudes")
      .select("*")
      .eq("user_id", id)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("task_assignments")
      .select("id, status, due_at, completed_at, created_at, tasks(title, type)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!profileData) notFound();
  const profile = profileData as Profile;
  const aptitudes = (aptitudesData ?? []) as UserAptitude[];
  const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];

  // 提出・AI評価（この利用者の案件に限定）
  const assignmentIds = assignments.map((a) => a.id);
  let revisionTotal = 0;
  let aiAvg: number | null = null;
  if (assignmentIds.length > 0) {
    const { data: subsData } = await supabase
      .from("submissions")
      .select("id, assignment_id, version")
      .in("assignment_id", assignmentIds);
    const subs = subsData ?? [];
    const maxVersion = new Map<string, number>();
    for (const s of subs) {
      maxVersion.set(
        s.assignment_id,
        Math.max(maxVersion.get(s.assignment_id) ?? 0, s.version),
      );
    }
    for (const v of maxVersion.values()) revisionTotal += Math.max(0, v - 1);

    if (subs.length > 0) {
      const { data: fbData } = await supabase
        .from("feedback")
        .select("score")
        .in(
          "submission_id",
          subs.map((s) => s.id),
        )
        .eq("status", "approved")
        .not("score", "is", null);
      const scores = (fbData ?? []).map((f) => f.score as number);
      if (scores.length > 0) {
        aiAvg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
    }
  }

  // 納期遵守率
  const doneWithDue = assignments.filter(
    (a) => a.status === "completed" && a.due_at,
  );
  const onTimeRate =
    doneWithDue.length === 0
      ? null
      : doneWithDue.filter(
          (a) =>
            a.completed_at &&
            new Date(a.completed_at).getTime() <=
              new Date(a.due_at!).getTime(),
        ).length / doneWithDue.length;

  // スタッフ評価（適性記録の平均）
  const latestByKey = new Map<AptitudeKey, UserAptitude>();
  for (const apt of aptitudes) {
    if (!latestByKey.has(apt.key)) latestByKey.set(apt.key, apt);
  }
  const latestRatings = [...latestByKey.values()].map((a) => a.rating);
  const staffAvg =
    latestRatings.length === 0
      ? null
      : latestRatings.reduce((sum, r) => sum + r, 0) / latestRatings.length;

  const active = assignments.filter((a) => a.status !== "completed");
  const completedCount = assignments.length - active.length;
  const hasOverdue = active.some((a) => isOverdue(a.due_at));

  let transferState: TransferState;
  if (active.some((a) => a.tasks?.type === "real")) {
    transferState = "本番対応中";
  } else if (hasOverdue || (aiAvg !== null && aiAvg < 3)) {
    transferState = "要フォロー";
  } else if (aiAvg !== null && aiAvg >= 4 && completedCount >= 2) {
    transferState = "移行候補";
  } else {
    transferState = "練習継続";
  }

  const judgeItems: { label: string; value: string }[] = [
    {
      label: "納期遵守率",
      value: onTimeRate === null ? "実績なし" : `${Math.round(onTimeRate * 100)}%`,
    },
    { label: "修正回数（累計）", value: `${revisionTotal}回` },
    {
      label: "AI評価（平均）",
      value: aiAvg === null ? "評価なし" : `${aiAvg.toFixed(1)} / 5`,
    },
    {
      label: "スタッフ評価（平均）",
      value: staffAvg === null ? "未記録" : `${staffAvg.toFixed(1)} / 5`,
    },
    { label: "完了案件数", value: `${completedCount}件` },
    { label: "対応中の案件", value: `${active.length}件` },
  ];

  return (
    <PageContainer>
      <Link
        href="/staff/users"
        className="inline-flex min-h-11 items-center gap-1 font-bold text-primary hover:text-primary-dark hover:underline"
      >
        <IconChevronLeft className="size-4" />
        利用者一覧にもどる
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <UserAvatar name={profile.display_name} />
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {profile.display_name} さん
            {profile.display_name_kana && (
              <span className="ml-2 text-base font-normal text-ink-soft">
                （{profile.display_name_kana}）
              </span>
            )}
          </h1>
        </div>
        <StatusBadge
          label={transferState}
          tone={TRANSFER_TONE[transferState]}
        />
      </div>
      {profile.notes && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-[15px] text-ink">
          配慮メモ: {profile.notes}
        </p>
      )}

      {/* 本番移行判定 */}
      <div className="mt-6">
        <SectionCard title="本番移行判定" icon={<IconHome />}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {judgeItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-line p-3"
              >
                <p className="text-xs text-ink-soft">{item.label}</p>
                <p className="mt-0.5 text-lg font-bold text-ink">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            判定「{transferState}
            」は直近の実績から算出した目安です。本番案件への移行はスタッフが総合的に判断して最終承認してください（自動では移行しません）。
            {/* TODO: 移行承認の記録機能（承認者・承認日時の保存）はDB項目追加後に実装する */}
          </p>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 適性・特性 */}
        <div className="space-y-6">
          <SectionCard title="適性・特性の記録" icon={<IconStar />}>
            <ul className="space-y-2">
              {(Object.keys(APTITUDE_LABELS) as AptitudeKey[]).map((key) => {
                const latest = latestByKey.get(key);
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink">
                        {APTITUDE_LABELS[key]}
                      </p>
                      {latest?.note && (
                        <p className="mt-0.5 text-sm text-ink-soft">
                          {latest.note}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm">
                      {latest ? (
                        <span aria-label={`評価 ${latest.rating} / 5`}>
                          <span className="text-primary">
                            {"●".repeat(latest.rating)}
                          </span>
                          <span className="text-line">
                            {"●".repeat(5 - latest.rating)}
                          </span>
                          <span className="ml-1.5 font-bold text-ink">
                            {latest.rating}/5
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-soft">未記録</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title="新しい記録を追加" icon={<IconUsers />}>
            <AptitudeForm userId={id} />
          </SectionCard>
        </div>

        {/* 案件履歴・記録履歴 */}
        <div className="space-y-6">
          <SectionCard title="案件の履歴" icon={<IconClipboard />}>
            {assignments.length === 0 ? (
              <EmptyState
                title="まだ案件がありません"
                description="案件管理から案件を配布できます。"
              />
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3"
                  >
                    <span className="min-w-0 font-bold text-ink">
                      {a.tasks?.title}
                    </span>
                    <span className="flex items-center gap-2">
                      {a.tasks && (
                        <TaskTypeBadge type={a.tasks.type} size="sm" />
                      )}
                      <AssignmentStatusBadge status={a.status} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="記録の履歴">
            {aptitudes.length === 0 ? (
              <p className="text-sm text-ink-soft">まだ記録がありません。</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-auto">
                {aptitudes.map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-xl bg-page p-3 text-sm"
                  >
                    <p className="text-ink-soft">
                      {new Date(apt.recorded_at).toLocaleDateString("ja-JP")} ・{" "}
                      {APTITUDE_LABELS[apt.key]} ・ 評価 {apt.rating}/5
                    </p>
                    {apt.note && <p className="mt-1 text-ink">{apt.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
