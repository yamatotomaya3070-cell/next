import { describe, expect, test } from "vitest";
import { plausibleWorkMinutes } from "./workTime";

describe("plausibleWorkMinutes", () => {
  test("目安の3倍までの時間は、そのまま評価に使う", () => {
    expect(plausibleWorkMinutes(120, 90)).toBe(120);
    expect(plausibleWorkMinutes(270, 90)).toBe(270);
  });

  test("目安の3倍を超える時間は押し忘れとみなして使わない", () => {
    expect(plausibleWorkMinutes(600, 90)).toBeNull();
  });

  test("時間が分からない（0や空）なら null", () => {
    expect(plausibleWorkMinutes(null, 90)).toBeNull();
    expect(plausibleWorkMinutes(0, 90)).toBeNull();
  });

  test("目安が無い案件は、時間をそのまま使う", () => {
    expect(plausibleWorkMinutes(600, null)).toBe(600);
  });
});
