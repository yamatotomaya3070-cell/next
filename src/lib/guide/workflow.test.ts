import { describe, expect, it } from "vitest";
import { getWorkSteps } from "./workflow";

const step = (steps: ReturnType<typeof getWorkSteps>, id: string) => {
  const s = steps.find((x) => x.id === id);
  if (!s) throw new Error(`step ${id} がありません`);
  return s;
};

describe("getWorkSteps", () => {
  it("絆の素材（YouTube動画生成で作った案件）は、スクリプトで並べる手順になる", () => {
    const steps = getWorkSteps("/guide", { autoArrange: true });
    expect(step(steps, "arrange").detail).toContain("絆_素材を並べる");
    expect(step(steps, "arrange").href).toBe("/guide/arrange#auto");
  });

  it("それ以外の案件は、自分で並べる手順と教科書の該当節を案内する", () => {
    const steps = getWorkSteps("/guide", { autoArrange: false });
    expect(step(steps, "arrange").detail).not.toContain("絆_素材を並べる");
    expect(step(steps, "arrange").href).toBe("/guide/arrange#manual-voices");
    expect(step(steps, "export").detail).not.toContain("絆_YouTube_720p");
  });

  it("すべてのステップの教科書リンクが、実在する章と節を指している", () => {
    for (const autoArrange of [true, false]) {
      for (const s of getWorkSteps("/guide", { autoArrange })) {
        if (s.guide === null) continue;
        expect(s.chapter, `${s.id} の章`).not.toBeNull();
        expect(s.href, `${s.id} の節`).toBe(`/guide/${s.guide.replace("#", "#")}`);
      }
    }
  });

  it("教科書の目次には、どのステップからも操作動画か教科書で行ける", () => {
    for (const s of getWorkSteps("/guide", { autoArrange: true })) {
      if (s.id === "submit") continue;
      expect(s.href ?? s.video, `${s.id}`).toBeTruthy();
    }
  });
});
