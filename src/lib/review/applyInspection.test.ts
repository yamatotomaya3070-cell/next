import { describe, expect, test } from "vitest";
import { MACHINE_CHECK_KEY, machineCheckCriterion, mergeInspectionIntoFeedback } from "./applyInspection";
import type { CheckResult } from "@/lib/types";

const CHECKED = [{ item: "最初から最後まで見直した", checked: true }];

const PASS_RESULT: CheckResult = {
  checks: [{ key: "duration", label: "完成尺", status: "pass", expected: "372秒", actual: "372秒" }],
  autoScore: 100,
};

const FAIL_RESULT: CheckResult = {
  checks: [
    { key: "duration", label: "完成尺", status: "fail", expected: "372秒 ±2秒", actual: "300秒" },
    { key: "volume", label: "音量", status: "pass", expected: "-20dB", actual: "-21dB" },
  ],
  autoScore: 50,
};

const draft = {
  id: "fb1",
  status: "pending_review" as const,
  reviewed_by: null,
  improve_points: ["作業時間をメモしておくと次に役立ちます"],
  criteria: [{ key: "reporting", label: "報告", score: 4, comment: "良い" }],
};

describe("mergeInspectionIntoFeedback", () => {
  test("検品が全部OKなら、くわしい評価に照合結果を足すだけで差し戻さない", () => {
    // Act
    const merged = mergeInspectionIntoFeedback(draft, {
      selfCheck: CHECKED,
      fileName: "a.mp4",
      checkResult: PASS_RESULT,
    });

    // Assert
    expect(merged.returnToTrainee).toBe(false);
    expect(merged.patch.status).toBeUndefined();
    expect(merged.patch.criteria.map((c) => c.key)).toEqual(["reporting", MACHINE_CHECK_KEY]);
  });

  test("検品に fail があれば公開状態にして理由を先頭に置き、AIの改善点は後ろに残す", () => {
    const merged = mergeInspectionIntoFeedback(draft, {
      selfCheck: CHECKED,
      fileName: "a.mp4",
      checkResult: FAIL_RESULT,
    });

    expect(merged.returnToTrainee).toBe(true);
    expect(merged.patch.status).toBe("approved");
    expect(merged.patch.score).toBeNull();
    expect(merged.patch.summary).toContain("あと1つ");
    expect(merged.patch.improve_points?.[0]).toContain("完成尺");
    expect(merged.patch.improve_points?.[1]).toBe("作業時間をメモしておくと次に役立ちます");
  });

  test("提出時に自動差し戻し済み（理由が既に入っている）でも理由を二重に並べない", () => {
    const unchecked = [{ item: "最初から最後まで見直した", checked: false }];
    const first = mergeInspectionIntoFeedback(draft, {
      selfCheck: unchecked,
      fileName: "a.mp4",
      checkResult: PASS_RESULT,
    });
    const returned = {
      ...draft,
      status: "approved" as const,
      improve_points: first.patch.improve_points ?? [],
    };

    const merged = mergeInspectionIntoFeedback(returned, {
      selfCheck: unchecked,
      fileName: "a.mp4",
      checkResult: FAIL_RESULT,
    });

    const selfCheckReasons = merged.patch.improve_points?.filter((p) =>
      p.includes("最初から最後まで見直した"),
    );
    expect(selfCheckReasons).toHaveLength(1);
    // セルフチェック + 尺 + AIの改善点
    expect(merged.patch.improve_points).toHaveLength(3);
  });

  test("再反映しても machine_check は1件だけ", () => {
    const once = mergeInspectionIntoFeedback(draft, {
      selfCheck: CHECKED,
      fileName: "a.mp4",
      checkResult: PASS_RESULT,
    });
    const twice = mergeInspectionIntoFeedback(
      { ...draft, criteria: once.patch.criteria },
      { selfCheck: CHECKED, fileName: "a.mp4", checkResult: FAIL_RESULT },
    );

    expect(twice.patch.criteria.filter((c) => c.key === MACHINE_CHECK_KEY)).toHaveLength(1);
  });
});

describe("machineCheckCriterion", () => {
  test("自動採点を0-5の星に丸め、各項目を1行にまとめる", () => {
    const c = machineCheckCriterion(FAIL_RESULT);
    expect(c.score).toBe(3); // 50/20 = 2.5 → 3
    expect(c.comment).toContain("完成尺: NG");
    expect(c.comment).toContain("音量: OK");
  });
});
