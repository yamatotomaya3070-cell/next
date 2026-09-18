import { notFound } from "next/navigation";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconUsers } from "@/components/ui/icons";
import { ChatFrame, ChatViewport } from "@/components/chat/ChatFrame";
import { ChatThread } from "@/components/chat/ChatThread";
import { RoomList } from "@/app/staff/messages/RoomList";
import {
  PREVIEW_ASSIGNMENT_ID,
  PREVIEW_ASSIGNMENT_TITLES,
  PREVIEW_MESSAGES,
  PREVIEW_ROOMS,
  PREVIEW_TRAINEE_ID,
} from "./fixtures";

/**
 * 開発環境だけ: ログイン・DBなしでチャット画面の見た目を確認する。
 * /local-preview/messages            … 利用者側
 * /local-preview/messages?as=staff   … 職員側（?user= で一覧の選択状態を再現）
 */
export default async function LocalMessagesPreview({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; user?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { as, user } = await searchParams;

  if (as === "staff") {
    const hasUserParam = !!user;
    return (
      <ChatViewport>
        <RoomList
          rooms={PREVIEW_ROOMS}
          selectedTraineeId={PREVIEW_TRAINEE_ID}
          basePath="/local-preview/messages?as=staff&"
          className={hasUserParam ? "hidden md:flex" : "flex"}
        />
        <ChatFrame
          title="利用者 花子 さん"
          subtitle="利用者とのやりとり"
          avatar={<UserAvatar name="利用者 花子" />}
          backHref="/local-preview/messages?as=staff"
          className={hasUserParam ? "flex" : "hidden md:flex"}
        >
          <ChatThread
            traineeId={PREVIEW_TRAINEE_ID}
            viewerKind="staff"
            viewerName="職員 太郎"
            initialMessages={PREVIEW_MESSAGES}
            assignmentTitles={PREVIEW_ASSIGNMENT_TITLES}
            emptyHint=""
            live={false}
          />
        </ChatFrame>
      </ChatViewport>
    );
  }

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
          traineeId={PREVIEW_TRAINEE_ID}
          viewerKind="trainee"
          viewerName="利用者 花子"
          initialMessages={PREVIEW_MESSAGES}
          assignmentTitles={PREVIEW_ASSIGNMENT_TITLES}
          taskOptions={[
            {
              assignmentId: PREVIEW_ASSIGNMENT_ID,
              title: PREVIEW_ASSIGNMENT_TITLES[PREVIEW_ASSIGNMENT_ID],
            },
          ]}
          emptyHint="まだメッセージはありません。"
          live={false}
        />
      </ChatFrame>
    </ChatViewport>
  );
}
