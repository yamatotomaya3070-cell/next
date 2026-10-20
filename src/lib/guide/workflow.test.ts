import { describe, expect, it } from "vitest";
import { getWorkSteps } from "./workflow";

describe("案件の作業のしかた", () => {
  const raw = getWorkSteps("/guide", { cutPractice: true });
  const arrange = getWorkSteps("/guide");

  it("カット練習の案件は カット → 映像 → 声 → 字幕・テロップ → BGM・効果音 → 書き出し の順に並ぶ", () => {
    const order = raw.map((s) => s.id);
    const idx = (id: string) => order.indexOf(id);
    expect(idx("brief")).toBe(0);
    expect(idx("cut")).toBeLessThan(idx("video"));
    expect(idx("video")).toBeLessThan(idx("subtitles"));
    expect(idx("subtitles")).toBeLessThan(idx("bgm"));
    expect(idx("bgm")).toBeLessThan(idx("export"));
    expect(order[order.length - 1]).toBe("submit");
  });

  it("自動で並べるスクリプト・用意した型・プリセットには頼らない", () => {
    for (const s of [...raw, ...arrange]) {
      expect(s.detail, s.id).not.toMatch(/絆_|絆の型|作業指示一覧|スクリプト/);
    }
  });

  it("どのステップも、実在するレッスンにつながる", () => {
    for (const s of [...raw, ...arrange]) {
      expect(s.href, s.id).toBe(`/guide/${s.guide}`);
      expect(s.lessonLabel, s.id).toMatch(/^\d-\d+ /);
    }
  });

  it("職員の画面では職員の教科書へつなぐ", () => {
    expect(getWorkSteps("/staff/guide")[0].href).toMatch(/^\/staff\/guide\//);
  });
});
