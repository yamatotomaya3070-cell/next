import { describe, expect, it } from "vitest";
import fixture from "./fixtures/arrange-nisa-2026-09-17.json";
import { simulateArrange } from "./arrangeSimulation";

// 実機（DaVinci Resolve 21）で「絆_素材を並べる」を実行した結果と、1フレームも違わないこと。
// これが通る限り、案件を登録する前にタイムラインの並びを正確に予測できる。
const frames = fixture.clipFrames as Record<string, number>;
const fileNames = Object.keys(frames);

describe("simulateArrange（実機の結果と一致）", () => {
  const result = simulateArrange({
    voices: fileNames.filter((n) => /^S\d{2}_\d{2}_.+\.wav$/.test(n)).map((name) => ({ name, frames: frames[name] })),
    videos: fileNames.filter((n) => /^S\d{2}_.+\.mp4$/.test(n)).map((name) => ({ name, frames: frames[name] })),
    opening: { name: "オープニング.mp4", frames: frames["オープニング.mp4"] },
    ending: { name: "エンディング.mp4", frames: frames["エンディング.mp4"] },
    bgm: { name: "BGM.wav", frames: frames["BGM.wav"] },
  });

  it("セリフ29本の開始位置と長さが一致する", () => {
    expect(result.voice).toEqual(fixture.expected.voice);
  });

  it("映像12本（オープニング・場面10本・エンディング）の開始位置と長さが一致する", () => {
    expect(result.video).toEqual(fixture.expected.video);
  });

  it("BGM17本の開始位置と長さが一致する", () => {
    expect(result.bgm).toEqual(fixture.expected.bgm);
  });

  it("全体の長さが一致する", () => {
    expect(result.totalFrames).toBe(fixture.expected.totalFrames);
  });

  it("置けないものは無い", () => {
    expect(result.problems).toEqual([]);
  });
});

describe("simulateArrange（素材が足りないとき）", () => {
  it("場面の映像が無いと、その場面を問題として返す", () => {
    const result = simulateArrange({
      voices: [{ name: "S01_01_ハル.wav", frames: 100 }],
      videos: [],
      opening: null,
      ending: null,
      bgm: { name: "BGM.wav", frames: 1000 },
    });
    expect(result.problems).toContain("S01 の場面の映像がありません");
  });

  it("BGM が無いと問題として返す", () => {
    const result = simulateArrange({
      voices: [{ name: "S01_01_ハル.wav", frames: 100 }],
      videos: [{ name: "S01_会話.mp4", frames: 150 }],
      opening: null,
      ending: null,
      bgm: null,
    });
    expect(result.problems).toContain("BGM.wav がありません");
  });
});
