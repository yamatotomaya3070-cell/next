import { requireRole, createClient } from "@/lib/supabase/server";
import type { QaLog } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconMessage, IconRobot } from "@/components/ui/icons";
import { AnswerForm } from "../AnswerForm";

export const dynamic = "force-dynamic";

/** 職員向け：利用者からの質問の一覧・回答（未回答＋回答済み履歴） */
export default async function StaffMessagesPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const { data: qaData, error } = await supabase
    .from("qa_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const logs = (qaData ?? []) as QaLog[];

  // 利用者名・案件名は別クエリで引いて対応表を作る
  const userIds = [...new Set(logs.map((l) => l.user_id))];
  const assignmentIds = [
    ...new Set(logs.map((l) => l.assignment_id).filter((v): v is string => !!v)),
  ];

  const [profilesRes, assignmentsRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    assignmentIds.length > 0
      ? supabase
          .from("task_assignments")
          .select("id, tasks(title)")
          .in("id", assignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map(
    ((profilesRes.data ?? []) as { id: string; display_name: string }[]).map(
      (p) => [p.id, p.display_name],
    ),
  );
  const titleByAssignment = new Map(
    (
      (assignmentsRes.data ?? []) as unknown as {
        id: string;
        tasks: { title: string } | null;
      }[]
    ).map((a) => [a.id, a.tasks?.title ?? null]),
  );

  const traineeName = (id: string) => nameById.get(id) ?? "不明";
  const taskTitle = (assignmentId: string | null): string | null =>
    assignmentId ? (titleByAssignment.get(assignmentId) ?? null) : null;

  const unanswered = logs.filter((l) => l.needs_staff && l.answer === null);
  const answered = logs.filter((l) => l.answer !== null);

  return (
    <PageContainer>
      <h1 className="text-xl font-bold text-ink">メッセージ</h1>
      <p className="mt-1 text-sm text-ink-soft">
        利用者から届いた質問を確認し、回答できます。回答したやりとりは下の履歴に残ります。
      </p>

      {/* 未回答 */}
      <div className="mt-6">
        <SectionCard
          title={`未回答の質問（${unanswered.length}件）`}
          icon={<IconRobot />}
        >
          {unanswered.length === 0 ? (
            <EmptyState
              icon={<IconMessage />}
              title="未回答の質問はありません"
              description="新しい質問が届くと、ここに表示されます。"
            />
          ) : (
            <div className="space-y-4">
              {unanswered.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  traineeName={traineeName(q.user_id)}
                  taskTitle={taskTitle(q.assignment_id)}
                >
                  <div className="mt-3">
                    <AnswerForm qaId={q.id} />
                  </div>
                </QuestionCard>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 回答済み履歴 */}
      <div className="mt-6">
        <SectionCard title="回答済みの履歴" icon={<IconMessage />}>
          {answered.length === 0 ? (
            <EmptyState
              icon={<IconMessage />}
              title="まだ回答した質問はありません"
              description="回答すると、ここに履歴として残ります。"
            />
          ) : (
            <div className="space-y-4">
              {answered.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  traineeName={traineeName(q.user_id)}
                  taskTitle={taskTitle(q.assignment_id)}
                >
                  <div className="mt-3 rounded-xl bg-primary-soft/50 p-3 text-[15px] leading-relaxed text-ink">
                    <span className="mb-1 block text-xs font-bold text-primary-dark">
                      {q.answered_by === "ai" ? "AI" : "スタッフ"}の回答
                    </span>
                    {q.answer}
                  </div>
                </QuestionCard>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}

/** 質問1件のカード（質問文・利用者名・案件名を表示。回答欄は children で差し込む） */
function QuestionCard({
  question,
  traineeName,
  taskTitle,
  children,
}: {
  question: QaLog;
  traineeName: string;
  taskTitle: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-page/50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <UserAvatar name={traineeName} size="sm" />
        <span className="font-medium text-ink">{traineeName} さん</span>
        <span>・{new Date(question.created_at).toLocaleString("ja-JP")}</span>
        {taskTitle ? (
          <StatusBadge label={taskTitle} tone="info" size="sm" />
        ) : (
          <StatusBadge label="案件に関係しない質問" tone="neutral" size="sm" />
        )}
      </div>
      <p className="mt-2 font-bold text-ink">{question.question}</p>
      {children}
    </div>
  );
}
