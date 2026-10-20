import { describe, expect, it } from "vitest";
import { sceneRange } from "./generate";

describe("sceneRange", () => {
  it("1分は少ないシーン、3分・5分以上は今まで通り", () => {
    expect(sceneRange(1)).toBe("4〜6");
    expect(sceneRange(3)).toBe("8〜12");
    expect(sceneRange(5)).toBe("12〜18");
  });
});
