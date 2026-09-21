import { describe, expect, test } from "vitest";
import { checkVoiceStructure, formatSec, voiceDisplayName, type VoicePlacement } from "./structure";

/** 見本どおりに並んだ4本のセリフ（提出は全体が0.3秒だけ後ろにズレている想定） */
function perfect(): VoicePlacement[] {
  return [
    { name: "S01_01_ナレーション.wav", sampleStartSec: 1.0, submissionStarts: [1.3] },
    { name: "S01_02_ミナ先生.wav", sampleStartSec: 5.2, submissionStarts: [5.5] },
    { name: "S01_03_ハル.wav", sampleStartSec: 9.8, submissionStarts: [10.1] },
    { name: "S02_01_ミナ先生.wav", sampleStartSec: 15.0, submissionStarts: [15.3] },
  ];
}

const statusOf = (items: ReturnType<typeof checkVoiceStructure>) =>
  Object.fromEntries(items.map((c) => [c.key, c.status]));

describe("checkVoiceStructure", () => {
  test("全部そろって順番も間隔も見本どおりなら4項目とも pass", () => {
    expect(statusOf(checkVoiceStructure(perfect()))).toEqual({
      voice_present: "pass",
      voice_duplicate: "pass",
      voice_order: "pass",
      voice_spacing: "pass",
    });
  });

  test("提出に無いセリフがあれば入れ忘れ fail。利用者向け文言にセリフ名が入る", () => {
    const voices = perfect();
    voices[2] = { ...voices[2], submissionStarts: [] };

    const items = checkVoiceStructure(voices);
    const present = items.find((c) => c.key === "voice_present")!;

    expect(present.status).toBe("fail");
    expect(present.actual).toContain("S01_03（ハル）");
    expect(present.message).toContain("1本入っていません");
    // 抜けたセリフの前後は「入れ忘れ」で説明できるので、間隔では二重に指摘しない
    expect(statusOf(items).voice_order).toBe("pass");
    expect(statusOf(items).voice_spacing).toBe("pass");
  });

  test("同じセリフが2回入っていれば重複 fail", () => {
    const voices = perfect();
    voices[1] = { ...voices[1], submissionStarts: [5.5, 20.0] };

    const dup = checkVoiceStructure(voices).find((c) => c.key === "voice_duplicate")!;

    expect(dup.status).toBe("fail");
    expect(dup.actual).toContain("S01_02（ミナ先生）が2回");
  });

  test("順番が入れ替わっていれば順番 fail（後ろに来るべきセリフを挙げる）", () => {
    const voices = perfect();
    // S01_02 と S01_03 を入れ替え
    voices[1] = { ...voices[1], submissionStarts: [10.1] };
    voices[2] = { ...voices[2], submissionStarts: [5.5] };

    const order = checkVoiceStructure(voices).find((c) => c.key === "voice_order")!;

    expect(order.status).toBe("fail");
    expect(order.actual).toContain("S01_03（ハル）");
  });

  test("前のセリフからの間隔が1.5秒より大きくズレていれば間隔 fail、全体のズレは許す", () => {
    const shifted = perfect().map((v) => ({ ...v, submissionStarts: [v.submissionStarts[0] + 4.0] }));
    expect(statusOf(checkVoiceStructure(shifted)).voice_spacing).toBe("pass");

    const gapped = perfect();
    gapped[3] = { ...gapped[3], submissionStarts: [15.3 + 3.0] };
    const spacing = checkVoiceStructure(gapped).find((c) => c.key === "voice_spacing")!;
    expect(spacing.status).toBe("fail");
    expect(spacing.actual).toContain("3.0秒長い");
    expect(spacing.message).toContain("18秒あたり");
  });

  test("見本の中でセリフが1本も見つからなければ全項目 unknown", () => {
    const voices = perfect().map((v) => ({ ...v, sampleStartSec: null }));
    const statuses = Object.values(statusOf(checkVoiceStructure(voices)));
    expect(statuses).toEqual(["unknown", "unknown", "unknown", "unknown"]);
  });
});

describe("表示用ヘルパー", () => {
  test("voiceDisplayName はファイル名を読みやすくする", () => {
    expect(voiceDisplayName("S02_03_ハル.wav")).toBe("S02_03（ハル）");
    expect(voiceDisplayName("other.wav")).toBe("other");
  });

  test("formatSec は分秒に直す", () => {
    expect(formatSec(372.4)).toBe("6分12秒");
    expect(formatSec(42)).toBe("42秒");
  });
});
