import { describe, expect, it } from "vitest";
import {
  emotionToExpression,
  normalizeScene,
  normalizeVideoProject,
  type VideoScene,
} from "./schema";
import { validateVideoProject } from "./validate";

describe("emotionToExpression", () => {
  it("感情を4種の表情に落とす", () => {
    expect(emotionToExpression("positive_surprise")).toBe("surprised");
    expect(emotionToExpression("calm_warm")).toBe("normal");
    expect(emotionToExpression("realization")).toBe("happy");
    expect(emotionToExpression("curious")).toBe("thinking");
  });
});

describe("normalizeScene", () => {
  it("不正なenumはフォールバックに寄せ、idを補完する", () => {
    const s = normalizeScene({ section: "???", visual: { type: "bogus" }, audio: [] }, 3);
    expect(s.id).toBe("scene_004");
    expect(s.section).toBe("basics");
    expect(s.visual.type).toBe("character_explanation");
    expect(s.audio).toEqual([]);
  });

  it("audio配列を正規化し、演技フィールドを既定で埋める", () => {
    const s = normalizeScene(
      { audio: [{ speaker: "mina", text: "こんにちは", emotion: "calm_warm", emphasis: ["こんにちは"] }, "ゴミ"] },
      0,
    );
    expect(s.audio).toHaveLength(1);
    expect(s.audio[0].speaker).toBe("mina");
    expect(s.audio[0].deliveryStyle).toBe("explain_calm");
    expect(s.audio[0].speakingRate).toBe("normal");
    expect(s.audio[0].emotionIntensity).toBe(2);
  });

  it("emotionIntensityは1〜3にクランプ", () => {
    expect(normalizeScene({ audio: [{ text: "a", emotionIntensity: 9 }] }, 0).audio[0].emotionIntensity).toBe(3);
    expect(normalizeScene({ audio: [{ text: "a", emotionIntensity: 0 }] }, 0).audio[0].emotionIntensity).toBe(1);
  });

  it("comparison の infographic を構造化して保持する", () => {
    const s = normalizeScene(
      {
        visual: {
          type: "comparison",
          infographic: {
            left: "銀行", right: "NISA",
            rows: [{ label: "税金", leftValue: "2万円", rightValue: "0円" }],
            emphasis: "+約171万円",
          },
        },
      },
      0,
    );
    expect(s.visual.infographic?.kind).toBe("comparison");
    if (s.visual.infographic?.kind === "comparison") {
      expect(s.visual.infographic.rows).toHaveLength(1);
      expect(s.visual.infographic.emphasis).toBe("+約171万円");
    }
  });

  it("type と合わない infographic は捨てる（character_explanation に comparison データは付かない）", () => {
    const s = normalizeScene({ visual: { type: "character_explanation", infographic: { left: "a", right: "b" } } }, 0);
    expect(s.visual.infographic).toBeNull();
  });

  it("endSec が start以下なら +6秒で補正", () => {
    const s = normalizeScene({ startSec: 10, endSec: 4 }, 0);
    expect(s.endSec).toBe(16);
  });
});

describe("normalizeVideoProject", () => {
  it("scene id を連番で振り直し、既定値を埋める", () => {
    const p = normalizeVideoProject({ scenes: [{ id: "x" }, { id: "y" }] }, "新NISA");
    expect(p.scenes.map((s) => s.id)).toEqual(["scene_001", "scene_002"]);
    expect(p.theme).toBe("新NISA");
    expect(p.targetMinutes).toBe(10);
  });

  it("非オブジェクト入力でも落ちない", () => {
    const p = normalizeVideoProject(null, "t");
    expect(p.scenes).toEqual([]);
    expect(p.title).toBe("無題の動画");
  });
});

describe("validateVideoProject", () => {
  function full(): unknown {
    const mk = (id: string, section: string, type: string, audio: unknown[], infographic?: unknown) => ({
      id, section, visual: { type, infographic }, audio,
    });
    return {
      title: "新NISAって結局何？", theme: "新NISA", targetMinutes: 10,
      scenes: [
        mk("s1", "hook", "number_animation", [{ speaker: "narrator", text: "毎月1万円。20年後、その差は約171万円。" }],
          { from: 0, to: 1710000, unit: "円" }),
        mk("s2", "basics", "infographic", [{ speaker: "mina", text: "NISAは利益に税金がかからない仕組みです。" }],
          { }),
        mk("s3", "example", "comparison", [{ speaker: "narrator", text: "通常なら2万円、NISAならゼロ円。" }],
          { left: "通常", right: "NISA", rows: [], emphasis: "0円" }),
        mk("s4", "summary", "text_emphasis", [{ speaker: "narrator", text: "長期・積立・分散。" }]),
        mk("s5", "cta", "process", [{ speaker: "mina", text: "はじめ方は3ステップだよ。" }],
          { steps: [{ title: "口座開設", detail: "ネットで申し込む" }] }),
      ],
    };
  }

  it("骨格が揃った動画は ok=true、尺を推定する", () => {
    const report = validateVideoProject(normalizeVideoProject(full()));
    expect(report.ok).toBe(true);
    expect(report.sceneCount).toBe(5);
    expect(report.estimatedSec).toBeGreaterThan(0);
    expect(report.missingSections).toEqual([]);
  });

  it("comparison に infographic が無いと error", () => {
    const bad = normalizeVideoProject({
      scenes: [{ id: "s", section: "example", visual: { type: "comparison" }, audio: [{ text: "x" }] }],
    });
    const report = validateVideoProject(bad);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.level === "error")).toBe(true);
  });

  it("骨格sectionの欠落を warn で報告", () => {
    const p = normalizeVideoProject({ scenes: [{ section: "basics", visual: { type: "character_explanation" }, audio: [{ text: "a" }] }] });
    const report = validateVideoProject(p);
    expect(report.missingSections).toContain("hook");
    expect(report.missingSections).toContain("cta");
  });
});
