import { describe, expect, test } from "vitest";
import type { ChatMessage } from "@/lib/types";
import {
  dayKey,
  formatDayLabel,
  formatMessageTime,
  formatRoomTime,
  groupMessagesByDay,
  mergeMessages,
  previewText,
} from "./format";

function msg(id: string, createdAt: string, body = "本文"): ChatMessage {
  return {
    id,
    trainee_id: "t1",
    sender_id: "t1",
    sender_kind: "trainee",
    sender_name: "花子",
    assignment_id: null,
    body,
    read_at: null,
    created_at: createdAt,
  };
}

// 日本時間 2026-09-18 10:00 を「今」とする
const NOW = new Date("2026-09-18T01:00:00.000Z");

describe("dayKey / formatMessageTime", () => {
  test("UTCの深夜でも日本時間の日付キーになる", () => {
    // UTC 9/17 16:30 = JST 9/18 01:30
    expect(dayKey("2026-09-17T16:30:00.000Z")).toBe("2026-09-18");
  });

  test("時刻は日本時間の「9:05」形式", () => {
    expect(formatMessageTime("2026-09-18T00:05:00.000Z")).toBe("9:05");
  });
});

describe("formatDayLabel", () => {
  test("今日・昨日は言葉で表す", () => {
    expect(formatDayLabel("2026-09-18T03:00:00.000Z", NOW)).toBe("今日");
    expect(formatDayLabel("2026-09-17T03:00:00.000Z", NOW)).toBe("昨日");
  });

  test("同じ年は月日と曜日、違う年は年付き", () => {
    expect(formatDayLabel("2026-09-10T03:00:00.000Z", NOW)).toBe("9月10日(木)");
    expect(formatDayLabel("2025-12-01T03:00:00.000Z", NOW)).toBe(
      "2025年12月1日(月)",
    );
  });
});

describe("formatRoomTime", () => {
  test("今日は時刻、それ以外は日付", () => {
    expect(formatRoomTime("2026-09-18T00:05:00.000Z", NOW)).toBe("9:05");
    expect(formatRoomTime("2026-09-10T00:05:00.000Z", NOW)).toBe("9/10");
  });
});

describe("groupMessagesByDay", () => {
  test("時刻順に並べ替えて日付ごとにまとめる", () => {
    const groups = groupMessagesByDay(
      [
        msg("c", "2026-09-18T02:00:00.000Z"),
        msg("a", "2026-09-17T01:00:00.000Z"),
        msg("b", "2026-09-17T05:00:00.000Z"),
      ],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual(["昨日", "今日"]);
    expect(groups[0].messages.map((m) => m.id)).toEqual(["a", "b"]);
    expect(groups[1].messages.map((m) => m.id)).toEqual(["c"]);
  });

  test("空なら空配列", () => {
    expect(groupMessagesByDay([], NOW)).toEqual([]);
  });
});

describe("mergeMessages", () => {
  test("重複IDは新しい内容で置き換え、時刻順を保つ", () => {
    const current = [
      msg("a", "2026-09-18T01:00:00.000Z"),
      msg("b", "2026-09-18T02:00:00.000Z"),
    ];
    const merged = mergeMessages(current, [
      {
        ...msg("a", "2026-09-18T01:00:00.000Z"),
        read_at: "2026-09-18T03:00:00.000Z",
      },
      msg("c", "2026-09-18T01:30:00.000Z"),
    ]);
    expect(merged.map((m) => m.id)).toEqual(["a", "c", "b"]);
    expect(merged[0].read_at).not.toBeNull();
    // 元の配列は変更しない
    expect(current.map((m) => m.id)).toEqual(["a", "b"]);
  });

  test("追加が無ければ同じ配列を返す", () => {
    const current = [msg("a", "2026-09-18T01:00:00.000Z")];
    expect(mergeMessages(current, [])).toBe(current);
  });
});

describe("previewText", () => {
  test("改行をつぶして長いものは省略する", () => {
    expect(previewText("こんにちは\n\nテロップの\n大きさは？")).toBe(
      "こんにちは テロップの 大きさは？",
    );
    expect(previewText("あ".repeat(50), 10)).toBe("あ".repeat(10) + "…");
  });
});
