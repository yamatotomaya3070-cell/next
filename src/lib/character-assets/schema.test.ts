import { describe, expect, it } from "vitest";
import {
  characterAssetStoragePath,
  expressionLabel,
  groupAssetsByCharacter,
  type CharacterAssetRecord,
} from "./schema";

function asset(
  characterKey: string,
  expression: CharacterAssetRecord["expression"],
): CharacterAssetRecord {
  return {
    id: `${characterKey}_${expression}`,
    style_guide_id: "sg1",
    character_key: characterKey,
    expression,
    seed: 1000,
    storage_path: characterAssetStoragePath("sg1", characterKey, expression),
    mime_type: "image/png",
    provider: "mock",
    created_at: "2026-08-08T00:00:00Z",
    updated_at: "2026-08-08T00:00:00Z",
  };
}

describe("characterAssetStoragePath", () => {
  it("styleGuideId/characterKey_expression.png の形にする", () => {
    expect(characterAssetStoragePath("sg1", "ao", "happy")).toBe("sg1/ao_happy.png");
  });
});

describe("expressionLabel", () => {
  it("既知の表情は日本語ラベルを返す", () => {
    expect(expressionLabel("normal")).toBe("ふつう");
    expect(expressionLabel("surprised")).toBe("おどろき");
  });
});

describe("groupAssetsByCharacter", () => {
  it("4表情そろっていれば isComplete=true、欠けていれば false", () => {
    const assets = [
      asset("ao", "normal"),
      asset("ao", "happy"),
      asset("ao", "surprised"),
      asset("ao", "thinking"),
      asset("midori", "normal"), // midori は1表情だけ
    ];
    const groups = groupAssetsByCharacter(assets, ["ao", "midori"]);
    expect(groups[0].characterKey).toBe("ao");
    expect(groups[0].isComplete).toBe(true);
    expect(groups[0].assets.length).toBe(4);
    expect(groups[1].characterKey).toBe("midori");
    expect(groups[1].isComplete).toBe(false);
  });

  it("表情は定義順（normal→happy→surprised→thinking）に並べる", () => {
    const assets = [asset("ao", "thinking"), asset("ao", "normal"), asset("ao", "happy")];
    const groups = groupAssetsByCharacter(assets, ["ao"]);
    expect(groups[0].assets.map((a) => a.expression)).toEqual(["normal", "happy", "thinking"]);
  });

  it("アセットが無いキャラも空グループで返す", () => {
    const groups = groupAssetsByCharacter([], ["ao"]);
    expect(groups[0].assets).toEqual([]);
    expect(groups[0].isComplete).toBe(false);
  });
});
