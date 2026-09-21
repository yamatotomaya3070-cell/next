import { describe, expect, test } from "vitest";
import { FINGERPRINT_SAMPLE_RATE, buildTrackIndex, findClipInTrack, fingerprint } from "./fingerprint";

const SR = FINGERPRINT_SAMPLE_RATE;

/** 決定的な疑似乱数（テストを毎回同じにする） */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * 声っぽい信号: 基本周波数がゆっくり揺れる倍音の束＋少しの雑音。
 * 純音だとどの区間も似てしまうため、周波数を乱数で動かして区間ごとに個性を持たせる。
 */
function voiceLike(seconds: number, seed: number): Float32Array {
  const rand = rng(seed);
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  let f0 = 120 + rand() * 120;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    if (i % 800 === 0) f0 = Math.max(90, Math.min(300, f0 + (rand() - 0.5) * 40));
    phase += (2 * Math.PI * f0) / SR;
    let v = 0;
    for (let h = 1; h <= 8; h++) v += Math.sin(phase * h + h) / h;
    out[i] = v * 0.25 + (rand() - 0.5) * 0.02;
  }
  return out;
}

function silence(seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * SR));
}

function concat(parts: Float32Array[]): Float32Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** BGM 風の低い持続音を重ね、全体の音量も変える（提出動画で起きる変化を模す） */
function withBgm(track: Float32Array, gain: number): Float32Array {
  const out = new Float32Array(track.length);
  for (let i = 0; i < track.length; i++) {
    const bgm = 0.08 * Math.sin((2 * Math.PI * 65 * i) / SR) + 0.05 * Math.sin((2 * Math.PI * 98 * i) / SR);
    out[i] = track[i] * gain + bgm;
  }
  return out;
}

const clipA = voiceLike(2.5, 11);
const clipB = voiceLike(3.0, 22);
const clipC = voiceLike(2.0, 33);
const clipD = voiceLike(2.5, 44); // トラックには入れない

describe("findClipInTrack", () => {
  test("トラック内の各クリップを正しい位置で見つけ、無いクリップは見つけない", () => {
    // Arrange: [1.0s 無音][A][0.5s][C][0.5s][B][1.0s]、BGM重ね＋音量0.6倍
    const track = withBgm(concat([silence(1.0), clipA, silence(0.5), clipC, silence(0.5), clipB, silence(1.0)]), 0.6);
    const index = buildTrackIndex(fingerprint(track));

    // Act
    const a = findClipInTrack(fingerprint(clipA), index);
    const b = findClipInTrack(fingerprint(clipB), index);
    const c = findClipInTrack(fingerprint(clipC), index);
    const d = findClipInTrack(fingerprint(clipD), index);

    // Assert
    expect(a).toHaveLength(1);
    expect(a[0].startSec).toBeCloseTo(1.0, 1);
    expect(c).toHaveLength(1);
    expect(c[0].startSec).toBeCloseTo(1.0 + 2.5 + 0.5, 1);
    expect(b).toHaveLength(1);
    expect(b[0].startSec).toBeCloseTo(1.0 + 2.5 + 0.5 + 2.0 + 0.5, 1);
    expect(d).toEqual([]);
  });

  test("同じクリップが2回使われていれば2か所とも返す", () => {
    const track = concat([silence(0.5), clipA, silence(2.0), clipB, silence(1.0), clipA, silence(0.5)]);
    const index = buildTrackIndex(fingerprint(track));

    const matches = findClipInTrack(fingerprint(clipA), index);

    expect(matches).toHaveLength(2);
    const starts = matches.map((m) => m.startSec).sort((x, y) => x - y);
    expect(starts[0]).toBeCloseTo(0.5, 1);
    expect(starts[1]).toBeCloseTo(0.5 + 2.5 + 2.0 + 3.0 + 1.0, 1);
  });

  test("クリップの後半が切られていると、カバー率が下がる", () => {
    const half = clipB.slice(0, Math.round(clipB.length * 0.3));
    const track = concat([silence(0.5), half, silence(1.0)]);
    const index = buildTrackIndex(fingerprint(track));

    const full = findClipInTrack(fingerprint(clipB), index, { minCoverage: 0 });

    expect(full).toHaveLength(1);
    expect(full[0].coverage).toBeLessThan(0.5);
    // 既定のカバー率(0.5)を要求すると「見つからない」扱いになる
    expect(findClipInTrack(fingerprint(clipB), index)).toEqual([]);
  });

  test("空のクリップやトラックでは何も返さない", () => {
    const index = buildTrackIndex(fingerprint(silence(3)));
    expect(findClipInTrack(fingerprint(new Float32Array(0)), index)).toEqual([]);
    expect(findClipInTrack(fingerprint(clipA), buildTrackIndex(fingerprint(new Float32Array(0))))).toEqual([]);
  });
});
