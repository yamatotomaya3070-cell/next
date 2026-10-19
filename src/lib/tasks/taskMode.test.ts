import { describe, expect, it } from "vitest";
import { taskModeOf } from "./taskMode";

const assets = (media_url: string | null) => [{ kind: "source_assets" as const, media_url }];

describe("taskModeOf", () => {
  it("支給素材の置き場所で、案件の作り方を見分ける", () => {
    expect(taskModeOf(assets("scene-raw/abc/assets.zip"))).toBe("cut_practice");
    expect(taskModeOf(assets("scene-nisa/abc/assets.zip"))).toBe("auto_arrange");
    expect(taskModeOf(assets("uploads/real-case.zip"))).toBe("manual");
  });

  it("支給素材が無い案件は、自分で並べる案件として扱う", () => {
    expect(taskModeOf([])).toBe("manual");
    expect(taskModeOf(assets(null))).toBe("manual");
  });
});
