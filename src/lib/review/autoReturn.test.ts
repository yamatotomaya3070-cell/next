import { describe, expect, test } from "vitest";
import { autoReturnSummary, decideAutoReturn } from "./autoReturn";
import type { CheckResult } from "@/lib/types";

const CHECKED = [
  { item: "依頼書のとおりに作業した", checked: true },
  { item: "最初から最後まで見直した", checked: true },
];

describe("decideAutoReturn", () => {
  test("セルフチェックが全部済み・mp4・検品なしなら差し戻さない", () => {
    // Arrange
    const input = { selfCheck: CHECKED, fileName: "新NISA.mp4", checkResult: null };

    // Act
    const decision = decideAutoReturn(input);

    // Assert
    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasons).toEqual([]);
  });

  test("セルフチェックに未チェックがあれば、その項目を理由に差し戻す", () => {
    // Arrange
    const input = {
      selfCheck: [
        { item: "依頼書のとおりに作業した", checked: true },
        { item: "最初から最後まで見直した", checked: false },
      ],
      fileName: "新NISA.mp4",
      checkResult: null,
    };

    // Act
    const decision = decideAutoReturn(input);

    // Assert
    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasons).toHaveLength(1);
    expect(decision.reasons[0]).toContain("最初から最後まで見直した");
  });

  test("動画以外のファイルが提出されたら差し戻す", () => {
    // Arrange
    const input = { selfCheck: CHECKED, fileName: "完成.drp", checkResult: null };

    // Act
    const decision = decideAutoReturn(input);

    // Assert
    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasons[0]).toContain("完成.drp");
  });

  test("拡張子の大文字小文字は区別しない", () => {
    // Arrange
    const input = { selfCheck: CHECKED, fileName: "KANSEI.MP4", checkResult: null };

    // Act & Assert
    expect(decideAutoReturn(input).shouldReturn).toBe(false);
  });

  test("ファイル名が無い場合は拡張子を理由にしない", () => {
    // Arrange
    const input = { selfCheck: CHECKED, fileName: null, checkResult: null };

    // Act & Assert
    expect(decideAutoReturn(input).shouldReturn).toBe(false);
  });

  test("機械検品の fail 項目を理由に差し戻す（pass/unknown は理由にしない）", () => {
    // Arrange
    const checkResult: CheckResult = {
      autoScore: 40,
      checks: [
        { key: "duration", label: "完成尺", status: "fail", expected: "226.2秒", actual: "120.0秒" },
        { key: "resolution", label: "解像度", status: "pass", expected: "1280x720", actual: "1280x720" },
        { key: "volume", label: "音量", status: "unknown", expected: "-18〜-14dB", actual: "取得できませんでした" },
      ],
    };
    const input = { selfCheck: CHECKED, fileName: "新NISA.mp4", checkResult };

    // Act
    const decision = decideAutoReturn(input);

    // Assert
    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasons).toHaveLength(1);
    expect(decision.reasons[0]).toContain("完成尺");
    expect(decision.reasons[0]).toContain("120.0秒");
  });

  test("複数のNGはすべて理由に並ぶ", () => {
    // Arrange
    const input = {
      selfCheck: [{ item: "見直した", checked: false }],
      fileName: "memo.txt",
      checkResult: {
        autoScore: 0,
        checks: [
          { key: "audio_stream", label: "音声トラック", status: "fail" as const, expected: "あり", actual: "なし" },
        ],
      },
    };

    // Act
    const decision = decideAutoReturn(input);

    // Assert
    expect(decision.reasons).toHaveLength(3);
  });
});

describe("autoReturnSummary", () => {
  test("1件のときは「あと1つ」と書く", () => {
    expect(autoReturnSummary(1)).toContain("あと1つ");
  });

  test("複数件のときは件数を書く", () => {
    expect(autoReturnSummary(3)).toContain("あと3つ");
  });
});
