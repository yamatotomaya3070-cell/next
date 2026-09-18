import { requireProfile, createClient } from "@/lib/supabase/server";
import type { Task, TaskAssignment } from "@/lib/types";
import { loadThread } from "@/lib/messages/load";
import { PageContainer } from "@/components/ui/PageContainer";
import { ErrorState } from "@/components/ui/states";
import { IconUsers } from "@/components/ui/icons";
import { ChatFrame, ChatViewport } from "@/components/chat/ChatFrame";
import { ChatThread } from "@/components/chat/ChatThread";
import type { ComposerTaskOption } from "@/components/chat/ChatComposer";

export const dynamic = "force-dynamic";

/** 利用者向け: 職員とのトーク（LINE風）。質問も返事もここで1本につながる */
export default async function MessagesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [thread, assignmentRes] = await Promise.all([
    loadThread(supabase, profile.id),
    supabase
      .from("task_assignments")
      .select("id, status, tasks(title)")
      .eq("user_id", profile.id)
      .neq("status", "completed")
      .order("created_at", { ascending: false }),
  ]);

  if (thread.error || !thread.data) {
    return (
      <PageContainer>
        <ErrorState
          title="メッセージを読み込めませんでした"
          description={thread.error ?? undefined}
        />
      </PageContainer>
    );
  }

  const assignments = (assignmentRes.data ?? []) as unknown as (Pick<
    TaskAssignment,
    "id" | "status"
  > & { tasks: Pick<Task, "title"> | null })[];
  const taskOptions: ComposerTaskOption[] = assignments
    .filter((a) => a.tasks?.title)
    .map((a) => ({ assignmentId: a.id, title: a.tasks!.title }));

  // 進行中の案件名も対応表に足しておく（送った直後の吹き出しに案件名を出すため）
  const assignmentTitles = {
    ...Object.fromEntries(taskOptions.map((o) => [o.assignmentId, o.title])),
    ...thread.data.assignmentTitles,
  };

  return (
    <ChatViewport>
      <ChatFrame
        title="職員とのやりとり"
        subtitle="困ったことは、いつでもここから聞けます"
        avatar={
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <IconUsers />
          </span>
        }
        className="flex"
      >
        <ChatThread
          traineeId={profile.id}
          viewerKind="trainee"
          viewerName={profile.display_name}
          initialMessages={thread.data.messages}
          assignmentTitles={assignmentTitles}
          taskOptions={taskOptions}
          emptyHint="まだメッセージはありません。わからないことがあれば、下の入力欄から気軽に送ってください。職員からの返事もここに届きます。"
        />
      </ChatFrame>
    </ChatViewport>
  );
}
