import { describe, expect, it } from "vitest";
import { LESSONS, getLesson } from "./lessons";
import { GUIDE_OPERATIONS, OP_CATEGORIES, POPULAR_SEARCH_WORDS, getOperation } from "./operations";
import { searchOperations } from "./opsSearch";

describe("操作辞典のデータ", () => {
  it("60項目以上あり、id が重ならない", () => {
    expect(GUIDE_OPERATIONS.length).toBeGreaterThanOrEqual(60);
    const ids = GUIDE_OPERATIONS.map((op) => op.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("id は URL に使える文字だけ", () => {
    for (const op of GUIDE_OPERATIONS) expect(op.id).toMatch(/^[a-z0-9-]+$/);
  });

  it("どの項目にも手順・場所・できることと、検索語がある", () => {
    for (const op of GUIDE_OPERATIONS) {
      expect(op.steps.length, op.id).toBeGreaterThan(0);
      expect(op.where.page, op.id).not.toBe("");
      expect(op.where.panel, op.id).not.toBe("");
      expect(op.what, op.id).not.toBe("");
      expect(op.aliases.length, op.id).toBeGreaterThan(0);
      expect(OP_CATEGORIES.some((c) => c.id === op.category), op.id).toBe(true);
    }
  });

  it("関連項目は実在する別の項目を指す", () => {
    for (const op of GUIDE_OPERATIONS) {
      for (const r of op.related ?? []) {
        expect(getOperation(r), `${op.id} → ${r}`).toBeDefined();
        expect(r, op.id).not.toBe(op.id);
      }
    }
  });

  it("教科書のレッスンへの参照は、実在するレッスンを指す", () => {
    for (const op of GUIDE_OPERATIONS) {
      if (!op.lesson) continue;
      expect(getLesson(op.lesson), op.id).toBeDefined();
    }
  });

  it("レッスンから辞典へのリンクは実在する項目を指す", () => {
    for (const l of LESSONS) {
      for (const id of l.ops ?? []) expect(getOperation(id), `${l.slug} → ${id}`).toBeDefined();
    }
  });

  it("「よく調べる言葉」は、どれも1件以上見つかる", () => {
    for (const w of POPULAR_SEARCH_WORDS) {
      expect(searchOperations(GUIDE_OPERATIONS, w).length, w).toBeGreaterThan(0);
    }
  });
});

describe("依頼書によく出る言葉で引ける", () => {
  const first = (q: string) => searchOperations(GUIDE_OPERATIONS, q)[0]?.op.id;

  it.each([
    ["フェードインしてください", "video-fade"],
    ["ふわっと出す", ["video-fade", "telop-fade"]],
    ["カット編集", "blade-cut"],
    ["テロップを入れてください", "text-add"],
    ["ＢＧＭ", "bgm-add"],
    ["音量を下げる", "volume-clip"],
    ["トランジション", "transition-add"],
    ["書き出し", "export-basic"],
    ["見本のように", "compare-sample"],
    ["すき間", "timeline-close-gap"],
    ["ズーム", "video-zoom"],
  ])("%s", (q, expected) => {
    const ids = Array.isArray(expected) ? expected : [expected];
    expect(ids).toContain(first(q));
  });
});
