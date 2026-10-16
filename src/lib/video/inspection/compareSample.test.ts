import { describe, expect, test } from "vitest";
import { compareProbeToSample } from "./compareSample";
import type { ProbeResult } from "./types";

const SAMPLE: ProbeResult = {
  durationSec: 372.4,
  width: 1920,
  height: 1080,
  hasVideo: true,
  hasAudio: true,
  meanVolumeDb: -20.5,
};

const byKey = (items: ReturnType<typeof compareProbeToSample>) =>
  Object.fromEntries(items.map((c) => [c.key, c.status]));

describe("compareProbeToSample", () => {
  test("見本と同じ実測値なら全項目 pass", () => {
    // Arrange
    const submission = { ...SAMPLE, durationSec: 373.1, meanVolumeDb: -22.0 };

    // Act
    const result = byKey(compareProbeToSample(submission, SAMPLE));

    // Assert
    expect(result).toEqual({
      duration: "pass",
      resolution: "pass",
      video_stream: "pass",
      audio_stream: "pass",
      volume: "pass",
    });
  });

  test("完成尺は参考として長さの差を見せるだけで、合否は決めない", () => {
    // 切れ・余りは「末尾のエンディング」、セリフのずれは「セリフの間隔」で見る
    const shortItem = compareProbeToSample({ ...SAMPLE, durationSec: 350 }, SAMPLE).find((c) => c.key === "duration");
    const longItem = compareProbeToSample({ ...SAMPLE, durationSec: 395 }, SAMPLE).find((c) => c.key === "duration");
    expect(shortItem?.status).toBe("pass");
    expect(shortItem?.actual).toContain("22.4秒 短い");
    expect(longItem?.status).toBe("pass");
    expect(longItem?.actual).toContain("22.6秒 長い");
  });

  test("解像度が違うと fail、取得できないと unknown", () => {
    expect(byKey(compareProbeToSample({ ...SAMPLE, width: 1280, height: 720 }, SAMPLE)).resolution).toBe("fail");
    expect(byKey(compareProbeToSample({ ...SAMPLE, width: null, height: null }, SAMPLE)).resolution).toBe("unknown");
  });

  test("音声トラックが無いと fail", () => {
    expect(byKey(compareProbeToSample({ ...SAMPLE, hasAudio: false }, SAMPLE)).audio_stream).toBe("fail");
  });

  test("音量差が6dBを超えると fail、見本の音量が無ければ unknown", () => {
    expect(byKey(compareProbeToSample({ ...SAMPLE, meanVolumeDb: -30 }, SAMPLE)).volume).toBe("fail");
    expect(byKey(compareProbeToSample(SAMPLE, { ...SAMPLE, meanVolumeDb: null })).volume).toBe("unknown");
  });
});
