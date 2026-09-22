import { describe, expect, test } from "vitest";
import {
  checkFrames,
  checkTelopStyle,
  detectTextBand,
  frameSimilarity,
  isTelopStyleOff,
  sliceRows,
  type FrameObservation,
  type GrayFrame,
} from "./frames";

function frame(width: number, height: number, fill: (x: number, y: number) => number): GrayFrame {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = fill(x, y);
  return { width, height, data };
}

describe("frameSimilarity", () => {
  test("同じ画像は 1、明るさを一様に変えても 1 に近い", () => {
    const a = frame(16, 9, (x, y) => (x * 13 + y * 7) % 256);
    const b = frame(16, 9, (x, y) => Math.min(255, ((x * 13 + y * 7) % 256) * 0.8 + 20));
    expect(frameSimilarity(a, a)).toBeCloseTo(1, 5);
    expect(frameSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  test("反転した画像は -1、無関係な模様は低い", () => {
    const a = frame(16, 9, (x) => (x * 16) % 256);
    const inv = frame(16, 9, (x) => 255 - ((x * 16) % 256));
    const other = frame(16, 9, (_x, y) => (y * 28) % 256);
    expect(frameSimilarity(a, inv)).toBeCloseTo(-1, 5);
    expect(Math.abs(frameSimilarity(a, other))).toBeLessThan(0.2);
  });

  test("両方とも一様なら明るさが近いときだけ同じ", () => {
    const black = frame(4, 4, () => 0);
    const black2 = frame(4, 4, () => 8);
    const white = frame(4, 4, () => 255);
    expect(frameSimilarity(black, black2)).toBe(1);
    expect(frameSimilarity(black, white)).toBe(0);
  });

  test("大きさが違うと例外", () => {
    expect(() => frameSimilarity(frame(4, 4, () => 0), frame(4, 3, () => 0))).toThrow();
  });

  test("sliceRows は行の範囲だけを切り出す", () => {
    const a = frame(3, 4, (_x, y) => y);
    const s = sliceRows(a, 1, 3);
    expect(s.height).toBe(2);
    expect(Array.from(s.data)).toEqual([1, 1, 1, 2, 2, 2]);
  });
});

describe("checkFrames", () => {
  const obs = (kind: FrameObservation["kind"], scene: string, similarity: number, sec = 10): FrameObservation => ({
    kind,
    scene,
    submissionSec: sec,
    similarity,
  });

  test("全部似ていれば3項目 pass", () => {
    const items = checkFrames([
      obs("opening", "オープニング", 0.95, 1),
      obs("ending", "エンディング", 0.9, 300),
      obs("scene", "S01", 0.9),
      obs("scene", "S02", 0.8),
    ]);
    expect(items.map((c) => c.status)).toEqual(["pass", "pass", "pass"]);
    expect(items[2].actual).toContain("2場面");
  });

  test("場面の全アンカーが明らかに違うときだけ場面 fail、一部なら unknown", () => {
    const fail = checkFrames([obs("scene", "S03", 0.1, 60), obs("scene", "S03", 0.2, 70), obs("scene", "S04", 0.9)]);
    expect(fail[2].status).toBe("fail");
    expect(fail[2].message).toContain("S03（1分0秒あたり）");

    const partial = checkFrames([obs("scene", "S03", 0.1), obs("scene", "S03", 0.9)]);
    expect(partial[2].status).toBe("unknown");
  });

  test("オープニングが明らかに違えば fail、観測が無ければ unknown", () => {
    const items = checkFrames([obs("opening", "オープニング", 0.2, 1), obs("opening", "オープニング", 0.3, 3)]);
    expect(items[0].status).toBe("fail");
    expect(items[0].message).toContain("オープニング");
    expect(items[1].status).toBe("unknown");
    expect(items[2].status).toBe("unknown");
  });
});

describe("detectTextBand", () => {
  /** 高さ 40 行の帯に、指定した行だけ白い文字（幅の 30%）を描く */
  function bandWithText(rows: number[], width = 100, height = 40): GrayFrame {
    return frame(width, height, (x, y) => (rows.includes(y) && x >= 35 && x < 65 ? 255 : 40));
  }

  test("白い行のかたまりをフレーム全体の位置に換算する", () => {
    // 帯はフレームの 70%〜100%（高さ 0.3）。行 20〜23 に文字
    const band = detectTextBand(bandWithText([20, 21, 22, 23]), 0.7, 0.3);
    expect(band).not.toBeNull();
    expect(band!.top).toBeCloseTo(0.7 + (20 / 40) * 0.3, 5);
    expect(band!.bottom).toBeCloseTo(0.7 + (24 / 40) * 0.3, 5);
  });

  test("小さな空き行はまとめ、一番大きいかたまりを採る", () => {
    const band = detectTextBand(bandWithText([5, 20, 21, 23, 24]), 0.7, 0.3);
    expect(band!.top).toBeCloseTo(0.7 + (20 / 40) * 0.3, 5);
    expect(band!.bottom).toBeCloseTo(0.7 + (25 / 40) * 0.3, 5);
  });

  test("文字が無ければ null、帯のほとんどが明るければ判定しない", () => {
    expect(detectTextBand(bandWithText([]), 0.7, 0.3)).toBeNull();
    const bright = frame(100, 40, () => 250);
    expect(detectTextBand(bright, 0.7, 0.3)).toBeNull();
  });
});

describe("checkTelopStyle", () => {
  const sample = { top: 0.85, bottom: 0.9 };

  test("位置のずれと高さの比で「違う」を決める", () => {
    expect(isTelopStyleOff(sample, { top: 0.85, bottom: 0.9 })).toBe(false);
    expect(isTelopStyleOff(sample, { top: 0.86, bottom: 0.92 })).toBe(false);
    expect(isTelopStyleOff(sample, { top: 0.7, bottom: 0.75 })).toBe(true); // 上に移動
    expect(isTelopStyleOff(sample, { top: 0.82, bottom: 0.93 })).toBe(true); // 2倍以上大きい
  });

  test("読み取れたセリフが少なければ unknown、全部一致なら pass", () => {
    const few = checkTelopStyle([{ voiceFile: "S01_01_ハル.wav", submissionSec: 5, sample, submission: sample }]);
    expect(few.status).toBe("unknown");
    const ok = checkTelopStyle(
      ["S01_01_ハル.wav", "S01_02_ミナ先生.wav", "S02_01_ハル.wav"].map((v, i) => ({
        voiceFile: v,
        submissionSec: 10 * i,
        sample,
        submission: sample,
      })),
    );
    expect(ok.status).toBe("pass");
  });

  test("半数以上かつ3本以上が違えば fail、少数なら unknown", () => {
    const moved = { top: 0.72, bottom: 0.77 };
    const mk = (n: number, offCount: number) =>
      Array.from({ length: n }, (_, i) => ({
        voiceFile: `S0${(i % 9) + 1}_01_ハル.wav`,
        submissionSec: 100 + i,
        sample,
        submission: i < offCount ? moved : sample,
      }));
    const fail = checkTelopStyle(mk(6, 4));
    expect(fail.status).toBe("fail");
    expect(fail.message).toContain("S01_01（ハル）");
    expect(checkTelopStyle(mk(6, 1)).status).toBe("unknown");
    expect(checkTelopStyle(mk(4, 2)).status).toBe("unknown"); // 半数だが3本未満
  });
});
