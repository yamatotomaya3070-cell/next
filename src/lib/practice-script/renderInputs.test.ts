import { describe, expect, it } from "vitest";
import { normalizeStyleGuide, type StyleGuideContent } from "@/lib/style-guide/schema";
import { normalizePracticeScript } from "./schema";
import { practiceRenderInputs, practiceVoiceProfiles } from "./renderInputs";

function guide(): StyleGuideContent {
  return normalizeStyleGuide({
    name: "テスト",
    characters: [
      { key: "ao", name: "アオ", subtitleColor: "#1677E8", seed: 1000 },
      { key: "midori", name: "ミドリ", subtitleColor: "#2E9E5B", seed: 2000 },
    ],
  });
}

describe("practiceVoiceProfiles", () => {
  it("スタイルガイドの話者を VoiceProfile 配列にする（順序維持）", () => {
    const profiles = practiceVoiceProfiles(guide());
    expect(profiles.map((p) => p.id)).toEqual(["ao", "midori"]);
    expect(profiles[0].label).toBe("アオ");
    expect(profiles[0].subtitleColor).toBe("#1677E8");
  });
});

describe("practiceRenderInputs", () => {
  it("セグメントを AudioScene とクリップに写す", () => {
    const script = normalizePracticeScript(
      {
        segments: [
          { id: "h", text: "導入", speakerKey: "ao", priority: "must", estimatedSeconds: 12, isHook: true },
          { id: "m", text: "本筋", speakerKey: "ao", priority: "must", estimatedSeconds: 30 },
          { id: "o", text: "雑談", speakerKey: "midori", priority: "optional", cutReason: "tangent", estimatedSeconds: 20 },
        ],
      },
      guide(),
    );
    const inputs = practiceRenderInputs(script, guide());
    expect(inputs.audioScenes[0]).toMatchObject({ id: "h", voiceId: "ao", narration: "導入", silenceSeconds: null });
    expect(inputs.clips[0]).toMatchObject({ filename: "clip_001.mp4", isMust: true, speakerKey: "ao" });
    expect(inputs.clips[2]).toMatchObject({ filename: "clip_003.mp4", isMust: false, speakerKey: "midori" });
  });

  it("空テキスト（間）は silenceSeconds を持つ", () => {
    const script = normalizePracticeScript(
      {
        segments: [
          { id: "a", text: "本筋", speakerKey: "ao", priority: "must", estimatedSeconds: 30 },
          { id: "b", text: "", speakerKey: "ao", priority: "must", estimatedSeconds: 4 },
          { id: "c", text: "つづき", speakerKey: "ao", priority: "must", estimatedSeconds: 30 },
        ],
      },
      guide(),
    );
    const inputs = practiceRenderInputs(script, guide());
    const silent = inputs.audioScenes.find((s) => s.id === "b");
    expect(silent?.narration).toBe("");
    expect(silent?.silenceSeconds).toBeGreaterThanOrEqual(2);
  });

  it("未知の話者キーは先頭話者に寄せる", () => {
    const g = guide();
    // normalize が既に寄せるが、renderInputs 側の防御も確認（先頭=ao）
    const script = normalizePracticeScript(
      { segments: [{ id: "x", text: "t", speakerKey: "zzz", priority: "must", estimatedSeconds: 10 }] },
      g,
    );
    const inputs = practiceRenderInputs(script, g);
    expect(inputs.audioScenes[0].voiceId).toBe("ao");
  });
});
