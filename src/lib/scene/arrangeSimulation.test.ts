import { describe, expect, it } from "vitest";
import fixture from "./fixtures/arrange-nisa-2026-09-17.json";
import { simulateArrange, type ClipInfo } from "./arrangeSimulation";

const bgm = { name: "BGM.wav", frames: 1000 };

describe("simulateArrange（セリフをすき間なくつなげる）", () => {
  // 音声ファイルには、次のセリフの頭までの無音が入っている前提（poc/scene/timing.mjs の voicePadding）
  const result = simulateArrange({
    voices: [
      { name: "S01_02_ミナ先生.wav", frames: 40 },
      { name: "S01_01_ハル.wav", frames: 30 },
      { name: "S02_01_ハル.wav", frames: 50 },
    ],
    videos: [
      { name: "S02_会話.mp4", frames: 50 },
      { name: "S01_会話.mp4", frames: 70 },
    ],
    opening: { name: "オープニング.mp4", frames: 24 },
    ending: { name: "エンディング.mp4", frames: 24 },
    bgm,
  });

  it("セリフは本編の頭から、場面をまたいでもすき間なく番号順に並ぶ", () => {
    expect(result.voice.map((v) => [v.name, v.start])).toEqual([
      ["S01_01_ハル.wav", 24],
      ["S01_02_ミナ先生.wav", 54],
      ["S02_01_ハル.wav", 94],
    ]);
  });

  it("場面の映像も本編の頭からすき間なく並び、エンディングはその後ろ", () => {
    expect(result.video.map((v) => [v.name, v.start, v.length])).toEqual([
      ["オープニング.mp4", 0, 24],
      ["S01_会話.mp4", 24, 70],
      ["S02_会話.mp4", 94, 50],
      ["エンディング.mp4", 144, 24],
    ]);
    expect(result.totalFrames).toBe(168);
  });

  it("BGM は本編の頭から終わりまで", () => {
    expect(result.bgm).toEqual([{ start: 24, length: 120 }]);
  });

  it("長さが揃っていれば問題は無い", () => {
    expect(result.problems).toEqual([]);
  });
});

describe("simulateArrange（新NISA の古い支給素材）", () => {
  // 2026-09-17 の素材は、セリフの間の無音が音声に入っていない（間を空けて並べる決まりだった）
  const frames = fixture.clipFrames as Record<string, number>;
  const fileNames = Object.keys(frames);
  const pick = (re: RegExp): ClipInfo[] =>
    fileNames.filter((n) => re.test(n)).map((name) => ({ name, frames: frames[name] }));
  const result = simulateArrange({
    voices: pick(/^S\d{2}_\d{2}_.+\.wav$/),
    videos: pick(/^S\d{2}_.+\.mp4$/),
    opening: { name: "オープニング.mp4", frames: frames["オープニング.mp4"] },
    ending: { name: "エンディング.mp4", frames: frames["エンディング.mp4"] },
    bgm: { name: "BGM.wav", frames: frames["BGM.wav"] },
  });

  it("映像はすき間なく続き、それぞれ素材のフレーム数どおりの長さで乗る", () => {
    expect(result.video).toHaveLength(12);
    for (let i = 1; i < result.video.length; i++) {
      const prev = result.video[i - 1];
      expect(result.video[i].start).toBe(prev.start + prev.length);
    }
    for (const v of result.video) expect(v.length).toBe(frames[v.name]);
  });

  it("セリフが映像より短く終わるので、古い素材だと分かる", () => {
    expect(result.voice).toHaveLength(29);
    expect(result.problems.some((p) => /^セリフと映像の長さが \d+フレーム合いません$/.test(p))).toBe(true);
  });
});

describe("simulateArrange（素材が足りないとき）", () => {
  it("場面の映像が無いと、その場面を問題として返す", () => {
    const result = simulateArrange({
      voices: [{ name: "S01_01_ハル.wav", frames: 100 }],
      videos: [],
      opening: null,
      ending: null,
      bgm,
    });
    expect(result.problems).toContain("S01 の場面の映像がありません");
  });

  it("セリフの合計が映像より長いと、ずれる分を問題として返す", () => {
    const result = simulateArrange({
      voices: [{ name: "S01_01_ハル.wav", frames: 120 }],
      videos: [{ name: "S01_会話.mp4", frames: 100 }],
      opening: null,
      ending: null,
      bgm,
    });
    expect(result.problems).toContain("セリフと映像の長さが 20フレーム合いません");
    expect(result.totalFrames).toBe(120);
  });

  it("BGM が無いと問題として返す", () => {
    const result = simulateArrange({
      voices: [{ name: "S01_01_ハル.wav", frames: 100 }],
      videos: [{ name: "S01_会話.mp4", frames: 100 }],
      opening: null,
      ending: null,
      bgm: null,
    });
    expect(result.problems).toContain("BGM.wav がありません");
  });
});
