import { describe, expect, it } from "vitest";
import { GUIDE_CHAPTERS, getGuideChapter } from "./chapters";
import { EDITING_CHAPTERS } from "./editingChapters";

describe("お仕事を受けるための編集の章", () => {
  it("カット・テロップ・BGMと効果音・声・見直しの5章が教科書に入っている", () => {
    for (const slug of ["cut", "telop-make", "bgm-se", "voice", "final-check"]) {
      expect(getGuideChapter(slug)?.part, slug).toBe("editing");
    }
  });

  it("章の slug と番号が、教科書全体で重ならない", () => {
    const slugs = GUIDE_CHAPTERS.map((c) => c.slug);
    const nos = GUIDE_CHAPTERS.map((c) => c.no);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(nos).size).toBe(nos.length);
  });

  it("職員向けの第10・11章の番号は変わらない（番号で案内しているため）", () => {
    expect(getGuideChapter("setup")?.no).toBe(10);
    expect(getGuideChapter("worker")?.no).toBe(11);
  });

  it("どの節にも手順があり、例には直す前・直した後・理由がそろっている", () => {
    for (const ch of EDITING_CHAPTERS) {
      for (const sec of ch.sections) {
        expect(sec.steps.length, `${ch.slug}#${sec.id}`).toBeGreaterThan(0);
        for (const ex of sec.examples ?? []) {
          expect(ex.before, `${ch.slug}#${sec.id}`).not.toBe("");
          expect(ex.after, `${ch.slug}#${sec.id}`).not.toBe(ex.before);
          expect(ex.why, `${ch.slug}#${sec.id}`).not.toBe("");
        }
      }
    }
  });
});
