import { requireProfile, createClient } from "@/lib/supabase/server";
import type { QaLog, Task, TaskAssignment } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconMessage } from "@/components/ui/icons";
import { QuestionForm, type QuestionTaskOption } from "@/components/QuestionForm";

export const dynamic = "force-dynamic";

/** 質問と回答のやりとり一覧（qa_logs）＋ その場で質問を送るフォーム */
export default async function MessagesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [qaRes, assignmentRes] = await Promise.all([
    supabase
      .from("qa_logs")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("task_assignments")
      .select("id, status, tasks(title)")
      .eq("user_id", profile.id)
      .neq("status", "completed")
      .order("created_at", { ascending: false }),
  ]);

  if (qaRes.error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const logs = (qaRes.data ?? []) as QaLog[];

  const assignments = (assignmentRes.data ?? []) as unknown as (Pick<
    TaskAssignment,
    "id" | "status"
  > & { tasks: Pick<Task, "title"> | null })[];

  const taskOptions: QuestionTaskOption[] = assignments
    .filter((a) => a.tasks?.title)
    .map((a) => ({ assignmentId: a.id, title: a.tasks!.title }));

  // 一覧で「どの案件についての質問か」を表示するための対応表
  const titleByAssignment = new Map(
    taskOptions.map((opt) => [opt.assignmentId, opt.title]),
  );

  return (
    <PageContainer>
      <h1 className="text-xl font-bold text-ink">メッセージ</h1>
      <p className="mt-1 text-sm text-ink-soft">
        職員への質問は、ここからいつでも送れます。作業の途中でも、案件が決まっていなくても大丈夫です。
      </p>

      <div className="mt-6">
        <SectionCard title="質問を送る" icon={<IconMessage />}>
          <QuestionForm taskOptions={taskOptions} />
        </SectionCard>
      </div>

      <h2 className="mt-8 text-lg font-bold text-ink">これまでのやりとり</h2>

      {logs.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<IconMessage />}
            title="まだメッセージはありません"
            description="困ったことがあれば、上のフォームから気軽に質問してください。"
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {logs.map((log) => {
            const taskTitle = log.assignment_id
              ? titleByAssignment.get(log.assignment_id)
              : null;
            return (
              <SectionCard key={log.id}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <span>
                    {new Date(log.created_at).toLocaleString("ja-JP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {taskTitle && (
                    <StatusBadge label={taskTitle} tone="neutral" size="sm" />
                  )}
                  {log.answer ? (
                    <StatusBadge label="回答あり" tone="success" size="sm" />
                  ) : (
                    <StatusBadge label="回答待ち" tone="warning" size="sm" />
                  )}
                </div>
                <p className="mt-2 rounded-xl bg-page p-3 text-[15px] leading-relaxed text-ink">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">
                    あなたの質問
                  </span>
                  {log.question}
                </p>
                {log.answer && (
                  <p className="mt-2 rounded-xl bg-primary-soft/60 p-3 text-[15px] leading-relaxed text-ink">
                    <span className="mb-1 block text-xs font-bold text-primary-dark">
                      {log.answered_by === "ai" ? "作業サポートAI" : "スタッフ"}
                      からの回答
                    </span>
                    {log.answer}
                  </p>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
