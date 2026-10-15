import { describe, expect, it } from "vitest";
import fixture from "./fixtures/arrange-nisa-2026-09-17.json";
import { GAP_F, HEAD_F, TAIL_F, simulateArrange, type ClipInfo } from "./arrangeSimulation";

// 新NISA の実際の素材（フレーム数）で「絆_素材を並べる」の並びを計算し、
// つなぎ目に隙間が無いこと・セリフがフレームの整数どおりに置かれることを確かめる。
const frames = fixture.clipFrames as Record<string, number>;
const fileNames = Object.keys(frames);
const pick = (re: RegExp): ClipInfo[] =>
  fileNames.filter((n) => re.test(n)).map((name) => ({ name, frames: frames[name] }));

describe("simulateArrange（新NISA の素材）", () => {
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

  it("BGM も本編の頭から終わりまですき間なく続く", () => {
    for (let i = 1; i < result.bgm.length; i++) {
      expect(result.bgm[i].start).toBe(result.bgm[i - 1].start + result.bgm[i - 1].length);
    }
  });

  it("最初の場面のセリフは、頭10フレーム・間7フレームの整数で置かれる", () => {
    const opening = frames["オープニング.mp4"];
    const s01 = result.voice.filter((v) => v.name.startsWith("S01_"));
    const expected: number[] = [];
    let cur = opening + HEAD_F;
    for (const v of s01) {
      expected.push(cur);
      cur += frames[v.name] + GAP_F;
    }
    expect(s01.map((v) => v.start)).toEqual(expected);
  });

  it("セリフ29本がすべて置かれ、全体の長さは映像の合計と同じ", () => {
    expect(result.voice).toHaveLength(29);
    const sum = result.video.reduce((n, v) => n + v.length, 0);
    expect(result.totalFrames).toBe(sum);
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

  it("場面の映像がセリフより短いと、黒い間ができるので問題として返す", () => {
    const result = simulateArrange({
      voices: [{ name: "S01_01_ハル.wav", frames: 100 }],
      videos: [{ name: "S01_会話.mp4", frames: 100 }],
      opening: null,
      ending: null,
      bgm: { name: "BGM.wav", frames: 1000 },
    });
    expect(result.problems).toContain(`S01 の場面の映像が ${HEAD_F + 100 + TAIL_F - 100}フレーム足りません`);
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
