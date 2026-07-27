import { describe, expect, it } from "vitest";
import { computeAutoScore } from "./score";
import type { CheckItem } from "./types";

function check(status: CheckItem["status"]): CheckItem {
  return { key: "k", label: "l", status, expected: "e", actual: "a" };
}

describe("computeAutoScore", () => {
  it("全項目 pass なら100点", () => {
    expect(computeAutoScore([check("pass"), check("pass"), check("pass")])).toBe(100);
  });

  it("全項目 fail なら0点", () => {
    expect(computeAutoScore([check("fail"), check("fail"), check("fail")])).toBe(0);
  });

  it("pass/fail が半々なら50点", () => {
    expect(computeAutoScore([check("pass"), check("fail")])).toBe(50);
  });

  it("unknown は pass/fail の中間(50%)として扱う", () => {
    expect(computeAutoScore([check("pass"), check("unknown")])).toBe(75);
  });

  it("項目が空の場合は0点を返す", () => {
    expect(computeAutoScore([])).toBe(0);
  });
});
