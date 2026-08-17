import { describe, expect, it } from "vitest";
import { normalizeStyleGuide, type StyleGuideContent } from "@/lib/style-guide/schema";
import {
  allDifficultyProfiles,
  difficultyProfile,
  resolveDifficultyTier,
} from "./difficulty";
import { buildPracticeCasePackage } from "./package";
import { normalizePracticeScript, type GeneratedPracticeScript } from "./schema";

function guide(): StyleGuideContent {
  return normalizeStyleGuide({
    name: "テスト",
    characters: [
      { key: "ao", name: "アオ", subtitleColor: "#1677E8", seed: 1000 },
      { key: "midori", name: "ミドリ", subtitleColor: "#2E9E5B", seed: 2000 },
    ],
  });
}

function script(): GeneratedPracticeScript {
  return normalizePracticeScript(
    {
      title: "つなぐラボ 次回の編集",
      episodeTitle: "在宅ワークの始め方",
      clientMessage: "次回もよろしくお願いします。\nたけし",
      segments: [
        { id: "h", text: "導入フックです", priority: "must", estimatedSeconds: 12, isHook: true },
        { id: "m1", text: "本筋その1", priority: "must", estimatedSeconds: 40 },
        { id: "m2", text: "本筋その2", priority: "must", estimatedSeconds: 40 },
        { id: "o1", text: "雑談です", priority: "optional", cutReason: "tangent", estimatedSeconds: 20 },
        { id: "o2", text: "えーっと", priority: "optional", cutReason: "filler", estimatedSeconds: 15 },
      ],
    },
    guide(),
    92,
  );
}

describe("resolveDifficultyTier", () => {
  it("既知のtierはそのプロファイルを返す", () => {
    expect(resolveDifficultyTier("beginner").tier).toBe("beginner");
    expect(resolveDifficultyTier("advanced").tier).toBe("advanced");
  });
  it("不正な値は intermediate にフォールバック", () => {
    expect(resolveDifficultyTier("nope").tier).toBe("intermediate");
    expect(resolveDifficultyTier(undefined).tier).toBe("intermediate");
  });
  it("難易度が上がるほど許容誤差は小さくなる", () => {
    expect(difficultyProfile("beginner").toleranceSec).toBeGreaterThan(
      difficultyProfile("advanced").toleranceSec,
    );
  });
  it("3段階そろっている", () => {
    expect(allDifficultyProfiles().map((p) => p.tier)).toEqual([
      "beginner",
      "intermediate",
      "advanced",
    ]);
  });
});

describe("buildPracticeCasePackage", () => {
  it("素材は全セグメント分、clip_NNN.mp4 のファイル名を持つ", () => {
    const pkg = buildPracticeCasePackage(script(), difficultyProfile("intermediate"), guide());
    expect(pkg.materials.length).toBe(5);
    expect(pkg.materials[0].filename).toBe("clip_001.mp4");
    expect(pkg.materials[4].filename).toBe("clip_005.mp4");
  });

  it("正解データは must/optional を分け、optional の理由を持つ", () => {
    const pkg = buildPracticeCasePackage(script(), difficultyProfile("intermediate"), guide());
    expect(pkg.answerData.mustSegmentIds).toEqual(["h", "m1", "m2"]);
    expect(pkg.answerData.optionalSegmentIds).toEqual(["o1", "o2"]);
    expect(pkg.answerData.cutReasonById.o1).toBe("tangent");
    expect(pkg.answerData.cutReasonById.o2).toBe("filler");
    expect(pkg.answerData.toleranceSec).toBe(difficultyProfile("intermediate").toleranceSec);
  });

  it("beginner は作業指示に切るクリップを明示、advanced は明示しない", () => {
    const beginner = buildPracticeCasePackage(script(), difficultyProfile("beginner"), guide());
    const advanced = buildPracticeCasePackage(script(), difficultyProfile("advanced"), guide());
    const beginnerText = beginner.workInstructions.join("\n");
    const advancedText = advanced.workInstructions.join("\n");
    expect(beginnerText).toContain("clip_004.mp4"); // optional の1本目(order4)を明示
    expect(advancedText).not.toContain("clip_004.mp4");
  });

  it("依頼書に依頼メッセージと完成尺が入る", () => {
    const pkg = buildPracticeCasePackage(script(), difficultyProfile("beginner"), guide());
    expect(pkg.requestDoc).toContain("たけし");
    expect(pkg.requestDoc).toContain("【動画の仕様】");
  });

  it("stats と難易度が結果に含まれる", () => {
    const pkg = buildPracticeCasePackage(script(), difficultyProfile("advanced"), guide());
    expect(pkg.difficulty).toBe("advanced");
    expect(pkg.stats.mustCount).toBe(3);
    expect(pkg.stats.optionalCount).toBe(2);
  });
});
