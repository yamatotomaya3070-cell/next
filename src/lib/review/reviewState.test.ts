import { describe, expect, test } from "vitest";
import {
  activeFeedback,
  latestSubmissionPerAssignment,
  reviewStateOf,
} from "./reviewState";
import type { Feedback } from "@/lib/types";

function fb(over: Partial<Feedback>): Feedback {
  return {
    id: "f1",
    submission_id: "s1",
    source: "ai",
    status: "pending_review",
    score: null,
    summary: null,
    good_points: null,
    improve_points: null,
    criteria: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-09-18T00:00:00Z",
    ...over,
  } as Feedback;
}

describe("reviewStateOf", () => {
  test("フィードバックが無ければ AIレビュー未実施", () => {
    expect(reviewStateOf([])).toBe("not_reviewed");
  });

  test("破棄された下書きしか無ければ AIレビュー未実施", () => {
    expect(reviewStateOf([fb({ status: "rejected" })])).toBe("not_reviewed");
  });

  test("承認待ちの下書きがあれば draft_pending", () => {
    expect(reviewStateOf([fb({ status: "pending_review" })])).toBe("draft_pending");
  });

  test("公開済みだが職員未確認なら auto_returned", () => {
    expect(reviewStateOf([fb({ status: "approved", reviewed_by: null })])).toBe(
      "auto_returned",
    );
  });

  test("職員が確定済みなら null（対応不要）", () => {
    expect(
      reviewStateOf([fb({ status: "approved", reviewed_by: "staff-1" })]),
    ).toBeNull();
  });

  test("職員確定済みが1件でもあれば、他に未処理があっても対応不要", () => {
    // Arrange: 破棄された下書きと確定済みが混在
    const feedbacks = [
      fb({ id: "old", status: "pending_review" }),
      fb({ id: "new", status: "approved", reviewed_by: "staff-1" }),
    ];

    // Act & Assert
    expect(reviewStateOf(feedbacks)).toBeNull();
  });
});

describe("activeFeedback", () => {
  test("承認待ちの下書きを優先して返す", () => {
    const pending = fb({ id: "p", status: "pending_review" });
    const auto = fb({ id: "a", status: "approved", reviewed_by: null });
    expect(activeFeedback([auto, pending])?.id).toBe("p");
  });

  test("承認待ちが無ければ自動差し戻しを返す", () => {
    const auto = fb({ id: "a", status: "approved", reviewed_by: null });
    expect(activeFeedback([fb({ status: "rejected" }), auto])?.id).toBe("a");
  });

  test("対象が無ければ null", () => {
    expect(activeFeedback([fb({ status: "rejected" })])).toBeNull();
  });
});

describe("latestSubmissionPerAssignment", () => {
  test("割当ごとに最新バージョンだけを残す", () => {
    // Arrange
    const submissions = [
      { id: "s1", assignment_id: "a1", version: 1 },
      { id: "s2", assignment_id: "a1", version: 2 },
      { id: "s3", assignment_id: "a2", version: 1 },
    ];

    // Act
    const result = latestSubmissionPerAssignment(submissions);

    // Assert
    expect(result.map((s) => s.id).sort()).toEqual(["s2", "s3"]);
  });

  test("並び順が逆でも最新を選ぶ", () => {
    const submissions = [
      { id: "s2", assignment_id: "a1", version: 2 },
      { id: "s1", assignment_id: "a1", version: 1 },
    ];
    expect(latestSubmissionPerAssignment(submissions).map((s) => s.id)).toEqual(["s2"]);
  });

  test("空配列なら空配列", () => {
    expect(latestSubmissionPerAssignment([])).toEqual([]);
  });
});
