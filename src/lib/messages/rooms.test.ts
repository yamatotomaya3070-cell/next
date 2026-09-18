import { describe, expect, test } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { buildRooms } from "./rooms";

function msg(traineeId: string, createdAt: string): ChatMessage {
  return {
    id: `${traineeId}-${createdAt}`,
    trainee_id: traineeId,
    sender_id: traineeId,
    sender_kind: "trainee",
    sender_name: "名前",
    assignment_id: null,
    body: "本文",
    read_at: null,
    created_at: createdAt,
  };
}

const trainees = [
  { id: "u1", display_name: "山田" },
  { id: "u2", display_name: "佐藤" },
  { id: "u3", display_name: "鈴木" },
  { id: "u4", display_name: "田中" },
];

describe("buildRooms", () => {
  test("未読あり → 最終メッセージが新しい順 → メッセージ無しは名前順", () => {
    const rooms = buildRooms(
      trainees,
      [
        msg("u1", "2026-09-18T01:00:00.000Z"),
        msg("u1", "2026-09-18T03:00:00.000Z"),
        msg("u2", "2026-09-18T05:00:00.000Z"),
        msg("u3", "2026-09-18T02:00:00.000Z"),
      ],
      ["u3", "u3"],
    );
    expect(rooms.map((r) => r.traineeId)).toEqual(["u3", "u2", "u1", "u4"]);
    expect(rooms[0].unreadCount).toBe(2);
    expect(rooms[2].lastMessage?.created_at).toBe("2026-09-18T03:00:00.000Z");
    expect(rooms[3].lastMessage).toBeNull();
  });

  test("利用者が居なければ空", () => {
    expect(
      buildRooms([], [msg("u1", "2026-09-18T01:00:00.000Z")], []),
    ).toEqual([]);
  });

  test("メッセージが1件も無い利用者同士は名前順（かな順）", () => {
    const kanaTrainees = [
      { id: "k1", display_name: "やまだ" },
      { id: "k2", display_name: "さとう" },
      { id: "k3", display_name: "すずき" },
    ];
    const rooms = buildRooms(kanaTrainees, [], []);
    expect(rooms.map((r) => r.traineeName)).toEqual(["さとう", "すずき", "やまだ"]);
  });
});
