import { describe, expect, it } from "vitest";
import { trimSilence } from "./trimSilence";

const RATE = 8000;
const voice = (leadSec: number, voiceSec: number, trailSec: number) => {
  const s = new Float32Array(Math.round((leadSec + voiceSec + trailSec) * RATE));
  const from = Math.round(leadSec * RATE);
  for (let i = 0; i < Math.round(voiceSec * RATE); i++) s[from + i] = 0.5 * Math.sin(i / 3);
  return s;
};

describe("trimSilence", () => {
  it("前後の無音を切り、頭に何秒あったかを返す", () => {
    const r = trimSilence(voice(0.5, 1, 0.3), RATE);
    expect(r.leadSec).toBeCloseTo(0.5, 2);
    expect(r.samples.length / RATE).toBeCloseTo(1, 1);
  });

  it("無音が無ければそのまま", () => {
    const r = trimSilence(voice(0, 1, 0), RATE);
    expect(r.leadSec).toBe(0);
    expect(r.samples.length).toBe(RATE);
  });

  it("全部無音なら切らない", () => {
    const s = new Float32Array(RATE);
    expect(trimSilence(s, RATE)).toEqual({ samples: s, leadSec: 0 });
  });
});
