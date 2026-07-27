import { describe, expect, it } from "vitest";
import { compareProbeToAnswer } from "./compare";
import type { ProbeResult } from "./types";
import type { TemplateAnswerData, VideoTemplateConfig } from "../templates/types";

function buildAnswerData(overrides: Partial<TemplateAnswerData> = {}): TemplateAnswerData {
  return {
    title: "テスト案件",
    templateType: "character_explainer",
    totalDurationSec: 60,
    toleranceSec: 1,
    volumeTargetDb: { min: -26, max: -12 },
    requiredEdits: ["音声の配置順序"],
    sceneOrder: ["scene_001"],
    subtitles: [],
    assets: [],
    ...overrides,
  };
}

function buildTemplateConfig(overrides: Partial<VideoTemplateConfig> = {}): VideoTemplateConfig {
  return {
    type: "character_explainer",
    label: "キャラクター解説",
    description: "",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    durationRange: { min: 30, max: 300, default: 60 },
    requiredAssetKinds: [],
    subtitleStyle: { maxCharsPerLine: 22, maxLines: 2, fontSize: 58, marginBottom: 64 },
    traineeTasks: [],
    aiPregenTasks: [],
    skillTags: [],
    defaultDifficulty: 1,
    gradingCriteria: [],
    toleranceSec: 1,
    ...overrides,
  };
}

function buildProbe(overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    durationSec: 60,
    width: 1920,
    height: 1080,
    hasVideo: true,
    hasAudio: true,
    meanVolumeDb: -18,
    ...overrides,
  };
}

describe("compareProbeToAnswer", () => {
  it("すべて期待どおりなら全項目 pass になる", () => {
    const checks = compareProbeToAnswer(buildProbe(), buildAnswerData(), buildTemplateConfig());
    expect(checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("尺が許容誤差内なら duration は pass", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ durationSec: 60.9 }),
      buildAnswerData({ totalDurationSec: 60, toleranceSec: 1 }),
      buildTemplateConfig(),
    );
    const duration = checks.find((c) => c.key === "duration");
    expect(duration?.status).toBe("pass");
  });

  it("尺が許容誤差を超えると duration は fail", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ durationSec: 65 }),
      buildAnswerData({ totalDurationSec: 60, toleranceSec: 1 }),
      buildTemplateConfig(),
    );
    const duration = checks.find((c) => c.key === "duration");
    expect(duration?.status).toBe("fail");
  });

  it("解像度が一致しないと resolution は fail", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ width: 1280, height: 720 }),
      buildAnswerData(),
      buildTemplateConfig({ width: 1920, height: 1080 }),
    );
    const resolution = checks.find((c) => c.key === "resolution");
    expect(resolution?.status).toBe("fail");
  });

  it("解像度が取得できない場合は resolution が unknown になる", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ width: null, height: null }),
      buildAnswerData(),
      buildTemplateConfig(),
    );
    const resolution = checks.find((c) => c.key === "resolution");
    expect(resolution?.status).toBe("unknown");
  });

  it("映像トラックが無いと video_stream は fail", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ hasVideo: false }),
      buildAnswerData(),
      buildTemplateConfig(),
    );
    expect(checks.find((c) => c.key === "video_stream")?.status).toBe("fail");
  });

  it("音声トラックが無いと audio_stream は fail", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ hasAudio: false }),
      buildAnswerData(),
      buildTemplateConfig(),
    );
    expect(checks.find((c) => c.key === "audio_stream")?.status).toBe("fail");
  });

  it("音量が範囲内なら volume は pass", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ meanVolumeDb: -20 }),
      buildAnswerData({ volumeTargetDb: { min: -26, max: -12 } }),
      buildTemplateConfig(),
    );
    expect(checks.find((c) => c.key === "volume")?.status).toBe("pass");
  });

  it("音量が範囲外なら volume は fail", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ meanVolumeDb: -40 }),
      buildAnswerData({ volumeTargetDb: { min: -26, max: -12 } }),
      buildTemplateConfig(),
    );
    expect(checks.find((c) => c.key === "volume")?.status).toBe("fail");
  });

  it("音量が計測できない場合は volume が unknown になる", () => {
    const checks = compareProbeToAnswer(
      buildProbe({ meanVolumeDb: null }),
      buildAnswerData(),
      buildTemplateConfig(),
    );
    expect(checks.find((c) => c.key === "volume")?.status).toBe("unknown");
  });
});
