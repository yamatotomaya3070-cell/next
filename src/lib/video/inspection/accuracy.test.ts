import { describe, expect, test } from "vitest";
import { renderAccuracyMarkdown, summarizeAccuracy, type VariantOutcome } from "./accuracy";
import type { CheckStatus } from "./types";

function outcome(
  variantId: string,
  expectedFails: string[],
  statuses: Record<string, CheckStatus>,
  allowedExtra: string[] = [],
): VariantOutcome {
  return {
    packageName: "pkg",
    variantId,
    title: variantId,
    expectedFails,
    allowedExtra,
    checks: Object.entries(statuses).map(([key, status]) => ({ key, label: key, status })),
    elapsedSec: 10,
  };
}

describe("summarizeAccuracy", () => {
  test("検出・誤検知・見逃し・職員確認を項目別に数える", () => {
    const s = summarizeAccuracy([
      outcome("cut", ["voice_present"], { voice_present: "fail", duration: "pass" }),
      outcome("clean", [], { voice_present: "pass", duration: "fail" }),
      outcome("missed", ["voice_present"], { voice_present: "pass", duration: "pass" }),
      outcome("doubt", ["voice_present"], { voice_present: "unknown", duration: "unknown" }),
    ]);
    const vp = s.keys.find((k) => k.key === "voice_present")!;
    expect([vp.tp, vp.fp, vp.fn, vp.unknownExpected, vp.unknownUnexpected]).toEqual([1, 0, 1, 1, 0]);
    const du = s.keys.find((k) => k.key === "duration")!;
    expect([du.tp, du.fp, du.fn, du.unknownExpected, du.unknownUnexpected]).toEqual([0, 1, 0, 0, 1]);
    expect(s.totalElapsedSec).toBe(40);
  });

  test("allowedExtra の項目は誤検知にも職員確認にも数えない", () => {
    const s = summarizeAccuracy([outcome("swap", ["voice_order"], { voice_order: "fail", voice_spacing: "fail" }, ["voice_spacing"])]);
    const sp = s.keys.find((k) => k.key === "voice_spacing")!;
    expect([sp.tp, sp.fp]).toEqual([0, 0]);
  });

  test("期待した項目が判定に無ければ見逃しに数える", () => {
    const s = summarizeAccuracy([outcome("x", ["telop_style"], { duration: "pass" })]);
    expect(s.keys.find((k) => k.key === "telop_style")!.fn).toBe(1);
  });

  test("提出単位の差し戻し判定を数える", () => {
    const s = summarizeAccuracy([
      outcome("a", ["voice_present"], { voice_present: "fail" }),
      outcome("b", ["voice_present"], { voice_present: "unknown" }),
      outcome("c", [], { voice_present: "pass" }),
      outcome("d", [], { voice_present: "fail" }),
      // 期待した項目は見逃したが、副作用で本当に間違っている項目が NG → 差し戻し自体は正しい
      outcome("e", ["frame_scene"], { frame_scene: "pass", telop_text: "fail" }, ["telop_text"]),
    ]);
    expect(s.submissions).toEqual({ total: 5, shouldReturn: 3, tp: 2, fp: 1, fn: 1 });
  });
});

describe("renderAccuracyMarkdown", () => {
  test("提出ごとに ○△✗ を付ける", () => {
    const outcomes = [
      outcome("ok", ["voice_present"], { voice_present: "fail" }),
      outcome("partial", ["voice_present", "duration"], { voice_present: "fail", duration: "pass" }),
      outcome("wrong", ["voice_present"], { voice_present: "pass" }),
      outcome("falsealarm", [], { voice_present: "fail" }),
    ];
    const md = renderAccuracyMarkdown(outcomes, summarizeAccuracy(outcomes), new Date("2026-09-22T00:00:00Z"));
    const rows = md.split("\n").filter((l) => l.startsWith("| ") && l.includes("| pkg |"));
    expect(rows.map((r) => r.slice(2, 3))).toEqual(["○", "△", "✗", "✗"]);
    expect(md).toContain("| 3 | 2 | 1 | 1 | 67% | 67% |");
  });
});
