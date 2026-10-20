import { describe, expect, it } from "vitest";
import { LESSONS } from "./index";
import { isMissingTable, summarizeProgress } from "./progress";

describe("教科書の進み具合", () => {
  it("何もしていなければ、最初のレッスンが次", () => {
    expect(summarizeProgress([])).toEqual({ done: 0, total: LESSONS.length, nextSlug: LESSONS[0].slug });
  });

  it("一本道なので、まだ終わっていない最初のレッスンが次（飛ばしたレッスンにもどる）", () => {
    const s = summarizeProgress([LESSONS[0].slug, LESSONS[2].slug]);
    expect(s.done).toBe(2);
    expect(s.nextSlug).toBe(LESSONS[1].slug);
  });

  it("今は無いレッスンの記録は数えない", () => {
    expect(summarizeProgress(["old-lesson"]).done).toBe(0);
  });

  it("全部終われば、次は無い", () => {
    expect(summarizeProgress(LESSONS.map((l) => l.slug)).nextSlug).toBeNull();
  });

  it("テーブルが無いエラーを見分ける", () => {
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(isMissingTable({ code: "23505" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
