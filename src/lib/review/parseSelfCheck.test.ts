import { describe, expect, test } from "vitest";
import { parseSelfCheck } from "./parseSelfCheck";

describe("parseSelfCheck", () => {
  test("正しい形のJSONはそのまま取り込む", () => {
    // Arrange
    const raw = JSON.stringify([
      { item: "依頼書のとおりに作業した", checked: true },
      { item: "見直した", checked: false },
    ]);

    // Act
    const result = parseSelfCheck(raw);

    // Assert
    expect(result).toEqual([
      { item: "依頼書のとおりに作業した", checked: true },
      { item: "見直した", checked: false },
    ]);
  });

  test("JSONとして壊れていれば空配列を返す", () => {
    expect(parseSelfCheck("{壊れている")).toEqual([]);
  });

  test("配列でなければ空配列を返す", () => {
    expect(parseSelfCheck(JSON.stringify({ item: "x", checked: true }))).toEqual([]);
  });

  test("形の合わない要素だけを捨てる", () => {
    // Arrange
    const raw = JSON.stringify([
      { item: "正しい項目", checked: true },
      { item: "checkedが文字列", checked: "true" },
      { checked: true },
      "ただの文字列",
      null,
      42,
      { item: "   ", checked: true },
    ]);

    // Act
    const result = parseSelfCheck(raw);

    // Assert
    expect(result).toEqual([{ item: "正しい項目", checked: true }]);
  });

  test("項目名の前後の空白は落とす", () => {
    expect(parseSelfCheck(JSON.stringify([{ item: "  見直した  ", checked: false }]))).toEqual([
      { item: "見直した", checked: false },
    ]);
  });
});
