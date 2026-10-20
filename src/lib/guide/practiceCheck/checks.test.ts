import { describe, expect, it } from "vitest";
import { analyzeSamples, beepSpans, gapsBetween, speechSpans, totalSec } from "./analyze";
import { checkBgm, checkCutBasics, checkCutMa, checkCutRemove, checkExport, checkVoiceLevel, MAX_UPLOAD_BYTES } from "./checks";
import { PRACTICE_KEYS } from "./keys.generated";

const RATE = 16000;

/** 声のかわり：300Hz と 450Hz をまぜて、ゆらした音（1kHz の成分はほぼない） */
function voice(sec: number, db = -12): Float32Array {
  const g = 10 ** (db / 20);
  return Float32Array.from({ length: Math.round(sec * RATE) }, (_, i) => {
    const t = i / RATE;
    return g * (0.6 * Math.sin(2 * Math.PI * 300 * t) + 0.4 * Math.sin(2 * Math.PI * 450 * t)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 3 * t));
  });
}
const tone = (sec: number, hz: number, db: number) =>
  Float32Array.from({ length: Math.round(sec * RATE) }, (_, i) => 10 ** (db / 20) * Math.sin((2 * Math.PI * hz * i) / RATE));
const silence = (sec: number) => new Float32Array(Math.round(sec * RATE));
const cat = (...parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const frames = (s: Float32Array) => analyzeSamples(s, RATE);
const allOk = (items: { ok: boolean }[]) => items.every((i) => i.ok);

describe("analyze", () => {
  it("声の区間と、そのあいだの沈黙を秒で出す", () => {
    const f = frames(cat(silence(0.5), voice(1), silence(0.8), voice(2), silence(0.3)));
    const sp = speechSpans(f);
    expect(sp).toHaveLength(2);
    expect(totalSec(sp)).toBeCloseTo(3, 1);
    expect(gapsBetween(sp)[0].end - gapsBetween(sp)[0].start).toBeCloseTo(0.8, 1);
  });

  it("1kHz のピーの音は声に入れず、ピーとして見つける", () => {
    const f = frames(cat(voice(1), silence(0.3), tone(0.6, 1000, -12), silence(0.3), voice(1)));
    expect(beepSpans(f)).toHaveLength(1);
    expect(totalSec(speechSpans(f))).toBeCloseTo(2, 1);
  });

  it("声の途中の短い切れ目（0.12秒より短い）は1つの声にまとめる", () => {
    expect(speechSpans(frames(cat(voice(1), silence(0.08), voice(1))))).toHaveLength(1);
  });
});

describe("2-1 ピーを消す", () => {
  const key = { speechSec: 3 };
  it("ピーを消して詰めてあれば全部 ○", () => {
    expect(allOk(checkCutBasics(frames(cat(voice(1), silence(0.3), voice(1), silence(0.3), voice(1))), key))).toBe(true);
  });
  it("ピーが残っている・消した所が空いたままは ×", () => {
    const beepLeft = checkCutBasics(frames(cat(voice(1), tone(0.6, 1000, -12), voice(1), silence(0.3), voice(1))), key);
    expect(beepLeft[0].ok).toBe(false);
    const hole = checkCutBasics(frames(cat(voice(1), silence(1.2), voice(1), silence(0.3), voice(1))), key);
    expect(hole[1].ok).toBe(false);
  });
  it("声まで消していたら ×", () => {
    expect(checkCutBasics(frames(cat(voice(1), silence(0.3), voice(1))), key)[2].ok).toBe(false);
  });
});

describe("2-2 いらない声を消す", () => {
  const key = { cleanSpeechSec: 4, rawSpeechSec: 6, extraToleranceSec: 0.3, lostToleranceSec: 0.6 };
  it("台本どおりなら ○", () => {
    expect(allOk(checkCutRemove(frames(cat(silence(0.2), voice(2), silence(0.4), voice(2))), key))).toBe(true);
  });
  it("「えー」が残れば ×、言葉まで消せば ×、録り始めの沈黙が残れば ×", () => {
    expect(checkCutRemove(frames(cat(voice(2), silence(0.4), voice(0.6), silence(0.4), voice(2))), key)[0].ok).toBe(false);
    expect(checkCutRemove(frames(cat(voice(2), silence(0.4), voice(1.2))), key)[1].ok).toBe(false);
    expect(checkCutRemove(frames(cat(silence(2), voice(2), silence(0.4), voice(2))), key)[2].ok).toBe(false);
  });
  it("声が台本の7割より少ないときは、並べ忘れを知らせる", () => {
    const r = checkCutRemove(frames(voice(2)), key);
    expect(r).toHaveLength(1);
    expect(r[0].text).toContain("S01 と S05");
  });
});

describe("2-3 間を整える", () => {
  const key = { speechSec: 3 };
  it("1秒より長い沈黙があれば × で、その時刻を出す", () => {
    const r = checkCutMa(frames(cat(voice(1), silence(2.5), voice(1), silence(0.3), voice(1))), key);
    expect(r[0].ok).toBe(false);
    expect(r[0].text).toContain("0:01 ごろ");
    expect(allOk(checkCutMa(frames(cat(voice(1), silence(0.8), voice(1), silence(0.3), voice(1))), key))).toBe(true);
  });
});

describe("2-9 BGM", () => {
  // オープニング2秒 → 声 → エンディング4秒。BGM は 220Hz の音
  const voicePart = cat(voice(3, -10), silence(0.4), voice(3, -10));
  const len = 2 + voicePart.length / RATE + 6;
  const key = { durationSec: len, voiceStart: 2, voiceEnd: 2 + voicePart.length / RATE };
  const withBgm = (db: number, fadeSec: number) => {
    const v = cat(silence(2), voicePart, silence(6));
    const b = tone(len, 220, db);
    const n = b.length;
    return v.map((x, i) => x + b[i] * (fadeSec > 0 ? Math.min(1, (n - i) / (fadeSec * RATE)) : 1));
  };
  it("小さめで最後がフェードアウトなら ○", () => {
    expect(allOk(checkBgm(frames(withBgm(-32, 2.5)), key))).toBe(true);
  });
  it("大きすぎ・フェードなし・BGM なしは ×", () => {
    expect(checkBgm(frames(withBgm(-12, 2.5)), key)[1].ok).toBe(false);
    expect(checkBgm(frames(withBgm(-32, 0)), key)[2].ok).toBe(false);
    expect(checkBgm(frames(cat(silence(2), voicePart, silence(6))), key)[0].ok).toBe(false);
  });
  it("長さがちがうときは、切らずに書き出すよう知らせる", () => {
    expect(checkBgm(frames(withBgm(-32, 2.5)), { ...key, durationSec: len + 5 })[0].text).toContain("切らずに");
  });
});

describe("2-11 声の大きさ", () => {
  const key = { sceneSec: [3, 3, 3], levelDb: [0, 0, 0] };
  const scene = (db: number) => cat(silence(0.3), voice(2.4, db), silence(0.3));
  it("そろっていれば ○、1場面だけ小さければその場面を出す", () => {
    expect(allOk(checkVoiceLevel(frames(cat(scene(-6), scene(-6), scene(-6))), key))).toBe(true);
    const r = checkVoiceLevel(frames(cat(scene(-6), scene(-13), scene(-6))), key);
    expect(r[0].ok).toBe(false);
    expect(r[0].text).toContain("場面2");
  });
  it("元の声の差（levelDb）は、ずれとして数えない", () => {
    expect(checkVoiceLevel(frames(cat(scene(-6), scene(-9), scene(-6))), { ...key, levelDb: [0, -3, 0] })[0].ok).toBe(true);
  });
  it("1場面だけ大きすぎるときは、その場面を「大きい」と言う（ほかを小さいと言わない）", () => {
    const r = checkVoiceLevel(frames(cat(scene(-6), scene(-6), scene(-1))), key);
    expect(r[0].text).toContain("場面3 が、ほかより約5dB 大きい");
    expect(r[0].text).not.toContain("小さい");
  });
  it("声の無い場面があれば、並べ方を知らせる", () => {
    const r = checkVoiceLevel(frames(cat(scene(-6), silence(3), scene(-6))), key);
    expect(r).toHaveLength(1);
    expect(r[0].text).toContain("場面2 に声が入っていません");
  });
  it("音がわれるほど大きければ ×", () => {
    expect(checkVoiceLevel(frames(cat(scene(0.5), scene(0.5), scene(0.5))), key)[1].ok).toBe(false);
  });
});

describe("1-5 書き出し", () => {
  const audio = frames(voice(2));
  const good = { width: 1280, height: 720, durationSec: 25.8, bytes: 2_500_000, isH264: true };
  it("指定どおりなら ○", () => {
    expect(allOk(checkExport(good, audio, PRACTICE_KEYS["dv-export"]))).toBe(true);
  });
  it("コーデック・大きさ・ファイルの重さのまちがいを ×", () => {
    expect(checkExport({ ...good, isH264: false }, audio, PRACTICE_KEYS["dv-export"])[0].ok).toBe(false);
    expect(checkExport({ ...good, width: 1920, height: 1080 }, audio, PRACTICE_KEYS["dv-export"])[1].ok).toBe(false);
    const big = checkExport({ ...good, bytes: MAX_UPLOAD_BYTES + 1 }, audio, PRACTICE_KEYS["dv-export"])[2];
    expect(big.ok).toBe(false);
    expect(big.text).toContain("送れません");
  });
  it("音が無ければ ×", () => {
    expect(checkExport(good, frames(silence(2)), PRACTICE_KEYS["dv-export"])[4].ok).toBe(false);
  });
});
