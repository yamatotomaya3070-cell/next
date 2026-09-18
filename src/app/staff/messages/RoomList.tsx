import Link from "next/link";
import type { ChatRoom } from "@/lib/messages/rooms";
import { formatRoomTime, previewText } from "@/lib/messages/format";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconMessage } from "@/components/ui/icons";

interface RoomListProps {
  rooms: ChatRoom[];
  selectedTraineeId: string | null;
  /** リンク先のベース（プレビューでは差し替える） */
  basePath?: string;
  className?: string;
}

/** 職員向け: 利用者ごとのトーク一覧（LINEのトークリスト相当） */
export function RoomList({
  rooms,
  selectedTraineeId,
  basePath = "/staff/messages",
  className = "",
}: RoomListProps) {
  const unreadTotal = rooms.reduce((sum, r) => sum + r.unreadCount, 0);

  return (
    <nav
      aria-label="利用者ごとのトーク"
      className={`w-full shrink-0 flex-col border-r border-line bg-surface md:w-80 ${className}`}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-4">
        <IconMessage className="text-primary" />
        <h1 className="text-base font-bold text-ink">メッセージ</h1>
        {unreadTotal > 0 && (
          <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
            未読 {unreadTotal}
          </span>
        )}
      </div>

      {rooms.length === 0 ? (
        <p className="p-6 text-center text-sm text-ink-soft">
          利用者がまだ登録されていません。
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {rooms.map((room) => {
            const active = room.traineeId === selectedTraineeId;
            const last = room.lastMessage;
            const preview = last
              ? `${last.sender_kind === "trainee" ? "" : "職員: "}${previewText(last.body, 30)}`
              : "まだやりとりはありません";
            return (
              <li key={room.traineeId}>
                <Link
                  href={`${basePath}?user=${room.traineeId}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 border-b border-line/70 px-4 py-3 transition hover:bg-page ${
                    active ? "bg-primary-soft/60" : ""
                  }`}
                >
                  <UserAvatar name={room.traineeName} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-[15px] ${
                          room.unreadCount > 0 ? "font-bold text-ink" : "font-medium text-ink"
                        }`}
                      >
                        {room.traineeName} さん
                      </span>
                      {last && (
                        <time
                          dateTime={last.created_at}
                          className="shrink-0 text-[11px] text-ink-soft"
                        >
                          {formatRoomTime(last.created_at)}
                        </time>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-xs ${
                          room.unreadCount > 0 ? "font-bold text-ink" : "text-ink-soft"
                        }`}
                      >
                        {preview}
                      </span>
                      {room.unreadCount > 0 && (
                        <span
                          aria-label={`未読${room.unreadCount}件`}
                          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white"
                        >
                          {room.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
