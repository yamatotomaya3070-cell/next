import type { ChatMessage } from "@/lib/types";
import type { ChatRoom } from "@/lib/messages/rooms";

export const PREVIEW_TRAINEE_ID = "11111111-1111-4111-8111-111111111111";
export const PREVIEW_ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";

function at(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seq = 0;
function m(
  partial: Pick<ChatMessage, "sender_kind" | "sender_name" | "body" | "created_at"> &
    Partial<ChatMessage>,
): ChatMessage {
  seq += 1;
  return {
    id: `preview-${seq}`,
    trainee_id: PREVIEW_TRAINEE_ID,
    sender_id: partial.sender_kind === "trainee" ? PREVIEW_TRAINEE_ID : "staff-1",
    assignment_id: null,
    read_at: null,
    ...partial,
  };
}

/** 開発プレビュー用のやりとり（3日分） */
export const PREVIEW_MESSAGES: ChatMessage[] = [
  m({
    sender_kind: "trainee",
    sender_name: "利用者 花子",
    body: "テロップの文字の大きさはどれくらいにすればいいですか？",
    assignment_id: PREVIEW_ASSIGNMENT_ID,
    read_at: at(2, 10, 30),
    created_at: at(2, 10, 12),
  }),
  m({
    sender_kind: "staff",
    sender_name: "職員 太郎",
    body: "編集指示書の「字幕の型」と同じ大きさで大丈夫です。\n迷ったら教科書の6章を見てください。",
    read_at: at(2, 10, 40),
    created_at: at(2, 10, 31),
  }),
  m({
    sender_kind: "staff",
    sender_name: "職員 太郎",
    body: "わからなければ、いつでも聞いてくださいね。",
    read_at: at(2, 10, 40),
    created_at: at(2, 10, 32),
  }),
  m({
    sender_kind: "trainee",
    sender_name: "利用者 花子",
    body: "ありがとうございます！やってみます。",
    read_at: at(2, 11, 0),
    created_at: at(2, 10, 45),
  }),
  m({
    sender_kind: "ai",
    sender_name: "作業サポートAI",
    sender_id: null,
    body: "書き出しは「絆_YouTube_720p」のプリセットを選ぶと、指定どおりの設定になります。",
    read_at: at(1, 15, 5),
    created_at: at(1, 15, 2),
  }),
  m({
    sender_kind: "trainee",
    sender_name: "利用者 花子",
    body: "動画を書き出したのですが、ファイルが大きすぎる気がします。これで提出して大丈夫でしょうか。",
    assignment_id: PREVIEW_ASSIGNMENT_ID,
    created_at: at(0, 9, 5),
  }),
  m({
    sender_kind: "trainee",
    sender_name: "利用者 花子",
    body: "サイズは 180MB でした。",
    created_at: at(0, 9, 6),
  }),
];

export const PREVIEW_ASSIGNMENT_TITLES: Record<string, string> = {
  [PREVIEW_ASSIGNMENT_ID]: "新NISAって結局何？（練習）",
};

export const PREVIEW_ROOMS: ChatRoom[] = [
  {
    traineeId: PREVIEW_TRAINEE_ID,
    traineeName: "利用者 花子",
    lastMessage: PREVIEW_MESSAGES[PREVIEW_MESSAGES.length - 1],
    unreadCount: 2,
  },
  {
    traineeId: "33333333-3333-4333-8333-333333333333",
    traineeName: "佐藤 次郎",
    lastMessage: m({
      sender_kind: "staff",
      sender_name: "職員 太郎",
      body: "提出ありがとうございます。レビューしますね。",
      created_at: at(1, 17, 20),
    }),
    unreadCount: 0,
  },
  {
    traineeId: "44444444-4444-4444-8444-444444444444",
    traineeName: "鈴木 三郎",
    lastMessage: null,
    unreadCount: 0,
  },
];
