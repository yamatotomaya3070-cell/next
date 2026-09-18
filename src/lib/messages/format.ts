import type { ChatMessage } from "@/lib/types";

/** 表示はすべて日本時間に固定する（利用者・職員とも国内運用） */
const TIME_ZONE = "Asia/Tokyo";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function sortByCreatedAt(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
  );
}

/** "2026-09-18" のような日付キー（日本時間） */
export function dayKey(iso: string): string {
  // sv-SE ロケールは YYYY-MM-DD 形式で出力される
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** 吹き出し横に出す時刻 "9:05" */
export function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** 日付区切りのラベル。今日/昨日は言葉で、それ以外は「9月18日(木)」、年が違えば年付き */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const target = dayKey(iso);
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - ONE_DAY_MS).toISOString());
  if (target === today) return "今日";
  if (target === yesterday) return "昨日";

  const sameYear = target.slice(0, 4) === today.slice(0, 4);
  const date = new Date(iso);
  const monthDay = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    ...(sameYear ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date);
  return `${monthDay}(${weekday})`;
}

/** ルーム一覧の「最終メッセージ時刻」。今日は時刻、それ以外は日付 */
export function formatRoomTime(iso: string, now: Date = new Date()): string {
  if (dayKey(iso) === dayKey(now.toISOString())) return formatMessageTime(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

export interface DayGroup {
  key: string;
  label: string;
  messages: ChatMessage[];
}

/** 送信時刻順に並べ替え、日付ごとにまとめる（日付区切り表示用） */
export function groupMessagesByDay(
  messages: ChatMessage[],
  now: Date = new Date(),
): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const m of sortByCreatedAt(messages)) {
    const key = dayKey(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(m);
    } else {
      groups.push({
        key,
        label: formatDayLabel(m.created_at, now),
        messages: [m],
      });
    }
  }
  return groups;
}

/** 受け取ったメッセージを既存一覧に足す（重複IDは新しい方で置き換え、時刻順を保つ） */
export function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return sortByCreatedAt([...byId.values()]);
}

/** 一覧のプレビュー用に1行へ縮める */
export function previewText(body: string, max = 40): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
