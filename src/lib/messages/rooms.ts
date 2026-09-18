import type { ChatMessage } from "@/lib/types";

export interface RoomTrainee {
  id: string;
  display_name: string;
}

/** 職員向けルーム一覧の1行 */
export interface ChatRoom {
  traineeId: string;
  traineeName: string;
  lastMessage: ChatMessage | null;
  /** 利用者からの未読件数（職員がまだ開いていない発言） */
  unreadCount: number;
}

/**
 * 利用者一覧＋最近のメッセージ＋未読行から、ルーム一覧を組み立てる。
 * 並び順: 未読ありを先頭 → 最終メッセージが新しい順 → メッセージ無しは名前順。
 */
export function buildRooms(
  trainees: RoomTrainee[],
  recentMessages: ChatMessage[],
  unreadTraineeIds: string[],
): ChatRoom[] {
  const lastByTrainee = new Map<string, ChatMessage>();
  for (const m of recentMessages) {
    const prev = lastByTrainee.get(m.trainee_id);
    if (!prev || prev.created_at < m.created_at) {
      lastByTrainee.set(m.trainee_id, m);
    }
  }
  const unread = new Map<string, number>();
  for (const id of unreadTraineeIds) {
    unread.set(id, (unread.get(id) ?? 0) + 1);
  }

  const rooms: ChatRoom[] = trainees.map((t) => ({
    traineeId: t.id,
    traineeName: t.display_name,
    lastMessage: lastByTrainee.get(t.id) ?? null,
    unreadCount: unread.get(t.id) ?? 0,
  }));

  return rooms.sort((a, b) => {
    const aUnread = a.unreadCount > 0 ? 1 : 0;
    const bUnread = b.unreadCount > 0 ? 1 : 0;
    if (aUnread !== bUnread) return bUnread - aUnread;
    const aTime = a.lastMessage?.created_at ?? "";
    const bTime = b.lastMessage?.created_at ?? "";
    if (aTime !== bTime) return aTime < bTime ? 1 : -1;
    return a.traineeName.localeCompare(b.traineeName, "ja");
  });
}
