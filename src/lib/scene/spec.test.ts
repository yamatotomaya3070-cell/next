import { describe, expect, it } from "vitest";
import { normalizeVideoProject } from "./schema";
import { buildVideoSpec, videoSpecToMarkdown } from "./spec";

function project(): unknown {
  return {
    title: "新NISAって結局何？", theme: "新NISA", audience: "投資初心者",
    goal: "非課税の仕組みを理解する", targetMinutes: 6,
    scenes: [
      { section: "hook", visual: { type: "text_emphasis", onScreenText: ["新NISA超入門"], description: "タイトルが出る" },
        audio: [{ speaker: "narrator", text: "投資初心者のための新NISA入門！" }], editingInstruction: "タイトルを大きく", requiredAsset: ["narration.wav"], qualityCheck: ["つかみがあるか"] },
      { section: "example", visual: { type: "comparison", onScreenText: ["0円"], description: "税金を比較",
          infographic: { left: "通常", right: "NISA", rows: [{ label: "税金", leftValue: "2万円", rightValue: "0円" }], emphasis: "0円" } },
        audio: [
          { speaker: "narrator", text: "通常なら2万円、NISAならゼロ円。", emphasis: ["ゼロ円"] },
          { speaker: "haru", text: "まるまる残るんだ！" },
        ], editingInstruction: "ゼロ円を強調", requiredAsset: ["infographic.svg", "narration.wav"], qualityCheck: ["差が一目で分かるか"],
        source: { ref: "税率20.315%", confirmedDate: "2026-08-15", fiscalYear: "2026", needsCheck: true } },
    ],
  };
}

describe("buildVideoSpec", () => {
  it("プロジェクトを仕様書構造に変換する", () => {
    const spec = buildVideoSpec(normalizeVideoProject(project()));
    expect(spec.title).toBe("新NISAって結局何？");
    expect(spec.sceneCount).toBe(2);
    expect(spec.scenes[0].visualType).toBe("強調テロップ");
    expect(spec.scenes[1].visualType).toBe("比較図");
    expect(spec.scenes[1].lines[0].speaker).toBe("ナレーション");
    expect(spec.scenes[1].lines[1].speaker).toBe("ハル");
  });

  it("素材・品質・出典を集約する", () => {
    const spec = buildVideoSpec(normalizeVideoProject(project()));
    expect(spec.assetList).toContain("narration.wav");
    expect(spec.assetList).toContain("infographic.svg");
    expect(spec.qualityCriteria.length).toBeGreaterThan(0);
    expect(spec.sourceNotes).toEqual([{ no: 2, ref: "税率20.315%" }]);
  });

  it("section の流れをまとめる", () => {
    const spec = buildVideoSpec(normalizeVideoProject(project()));
    expect(spec.sectionFlow[0].section).toBe("導入・フック");
    expect(spec.sectionFlow[1].section).toBe("具体例");
  });
});

describe("videoSpecToMarkdown", () => {
  it("Markdown に必須の見出しとセリフが含まれる", () => {
    const md = videoSpecToMarkdown(buildVideoSpec(normalizeVideoProject(project())));
    expect(md).toContain("# 動画制作仕様書：新NISAって結局何？");
    expect(md).toContain("## 3. シーン別仕様");
    expect(md).toContain("ミナ先生" === "ミナ先生" ? "ハル：「まるまる残るんだ！」" : "");
    expect(md).toContain("強調：ゼロ円");
  });
});
