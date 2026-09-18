import Link from "next/link";
import { requireRole, createClient } from "@/lib/supabase/server";
import { loadRooms, loadThread } from "@/lib/messages/load";
import { PageContainer } from "@/components/ui/PageContainer";
import { ErrorState } from "@/components/ui/states";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconMessage } from "@/components/ui/icons";
import { ChatFrame, ChatViewport } from "@/components/chat/ChatFrame";
import { ChatThread } from "@/components/chat/ChatThread";
import { RoomList } from "./RoomList";

export const dynamic = "force-dynamic";

/**
 * 職員向け: 左に利用者ごとのトーク一覧、右に選んだ利用者とのトーク（LINE風）。
 * ?user=<利用者ID> でトークを選ぶ。スマホでは一覧かトークのどちらか一方を表示する。
 */
export default async function StaffMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user } = await searchParams;
  const profile = await requireRole("staff", "admin");
  const supabase = await createClient();

  const { rooms, error } = await loadRooms(supabase);
  if (error) {
    return (
      <PageContainer>
        <ErrorState title="メッセージを読み込めませんでした" description={error} />
      </PageContainer>
    );
  }

  // 指定が無ければ先頭（未読あり→新しい順）のトークを開く。スマホでは一覧を優先する
  const hasUserParam = !!user;
  const selected =
    rooms.find((r) => r.traineeId === user) ?? (hasUserParam ? null : rooms[0] ?? null);
  const thread = selected ? await loadThread(supabase, selected.traineeId) : null;

  return (
    <ChatViewport>
      <RoomList
        rooms={rooms}
        selectedTraineeId={selected?.traineeId ?? null}
        className={hasUserParam ? "hidden md:flex" : "flex"}
      />

      {selected && thread?.data ? (
        <ChatFrame
          title={`${selected.traineeName} さん`}
          subtitle="利用者とのやりとり"
          avatar={<UserAvatar name={selected.traineeName} />}
          backHref="/staff/messages"
          action={
            <Link
              href={`/staff/users/${selected.traineeId}`}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:border-primary/40 hover:text-primary"
            >
              利用者ページ
            </Link>
          }
          className={hasUserParam ? "flex" : "hidden md:flex"}
        >
          <ChatThread
            key={selected.traineeId}
            traineeId={selected.traineeId}
            viewerKind="staff"
            viewerName={profile.display_name}
            initialMessages={thread.data.messages}
            assignmentTitles={thread.data.assignmentTitles}
            emptyHint={`${selected.traineeName} さんとのやりとりはまだありません。最初のメッセージを送ってみましょう。`}
          />
        </ChatFrame>
      ) : (
        <div
          className={`min-w-0 flex-1 flex-col items-center justify-center bg-chat p-6 text-center ${
            hasUserParam ? "flex" : "hidden md:flex"
          }`}
        >
          <IconMessage className="size-10 text-ink-soft/50" />
          <p className="mt-3 font-bold text-ink">
            {thread?.error ?? "左の一覧から利用者を選んでください"}
          </p>
        </div>
      )}
    </ChatViewport>
  );
}
