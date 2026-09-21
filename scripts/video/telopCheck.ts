/**
 * 字幕照合の実行（ffmpeg と Gemini に依存するためワーカー側に置く）。
 *
 * 構成照合（structureCheck）で分かった「提出動画の中で各セリフが始まる秒」を使い、
 * セリフの途中2か所で画面下部を切り出して OCR し、作業指示一覧の文と比べる。
 */
import { checkTelops, parseTelopExpectations, type TelopObservation } from "../../src/lib/video/inspection/telop";
import type { CheckItem } from "../../src/lib/video/inspection/types";
import type { VoiceMatchDetail } from "./structureCheck";
import { extractSubtitleStrip, isOcrAvailable, ocrSubtitleStrips } from "./telopOcr";

/** セリフの長さに対して、この割合の位置で画面を撮る（頭と尻は字幕の出入りで不安定なため避ける） */
const FIRST_POSITION = 0.5;
const RETRY_POSITIONS = [0.3, 0.7] as const;

export interface TelopCheckInput {
  workdir: string;
  submissionFile: string;
  /** 作業指示一覧（CSV または Markdown 表）。無ければ照合できない */
  instructionText: string | null;
  /** 構成照合の結果（セリフごとの提出動画内の位置と長さ） */
  voices: VoiceMatchDetail[];
  /** 各セリフ音声の長さ（秒）。name → 秒 */
  voiceDurations: Record<string, number>;
}

export interface TelopCheckResult {
  checks: CheckItem[];
  observations: TelopObservation[];
  /** 照合をしなかった理由（ログ・職員向け） */
  skippedReason: string | null;
}

function unknownItems(reason: string): CheckItem[] {
  return [
    { key: "telop_present", label: "字幕の入れ忘れ", status: "unknown", expected: "－", actual: reason },
    { key: "telop_text", label: "字幕の文", status: "unknown", expected: "－", actual: reason },
  ];
}

export async function runTelopCheck(input: TelopCheckInput): Promise<TelopCheckResult> {
  if (!input.instructionText) {
    const reason = "作業指示一覧が無いため字幕は確認していません";
    return { checks: unknownItems(reason), observations: [], skippedReason: reason };
  }
  if (!isOcrAvailable()) {
    const reason = "文字認識（GEMINI_API_KEY）が使えないため字幕は確認していません";
    return { checks: unknownItems(reason), observations: [], skippedReason: reason };
  }

  const expectations = new Map(parseTelopExpectations(input.instructionText).map((e) => [e.voiceFile, e.text]));
  if (expectations.size === 0) {
    const reason = "作業指示一覧から字幕の文を読み取れませんでした";
    return { checks: unknownItems(reason), observations: [], skippedReason: reason };
  }

  // 提出動画の中で見つかったセリフだけが対象（見つからないセリフは構成照合が「入れ忘れ」にする）
  const targets = input.voices
    .filter((v) => v.inSubmission.length > 0 && expectations.has(v.name))
    .map((v) => ({
      name: v.name,
      expected: expectations.get(v.name)!,
      startSec: Math.min(...v.inSubmission.map((m) => m.startSec)),
      durationSec: input.voiceDurations[v.name] ?? 2,
    }));
  if (targets.length === 0) {
    const reason = "字幕を確認できるセリフがありませんでした";
    return { checks: unknownItems(reason), observations: [], skippedReason: reason };
  }

  const stripAt = (t: (typeof targets)[number], pos: number) =>
    extractSubtitleStrip(input.submissionFile, input.workdir, Math.max(0, t.startSec + t.durationSec * pos));

  // 1回目: セリフの真ん中で1枚。ここで文字が読めれば十分（時間と API 呼び出しを節約する）
  const firstTexts = await ocrSubtitleStrips(targets.map((t) => stripAt(t, FIRST_POSITION)));
  if (!firstTexts) {
    const reason = "文字認識（GEMINI_API_KEY）が使えないため字幕は確認していません";
    return { checks: unknownItems(reason), observations: [], skippedReason: reason };
  }
  const ocrTexts: string[][] = firstTexts.map((t) => [t]);

  // 2回目: 文字が無かったセリフだけ、前後の位置でもう2枚撮って確かめる（字幕の出入りの瞬間を避ける）
  const retryIdx = targets.map((_, i) => i).filter((i) => firstTexts[i].trim().length === 0);
  if (retryIdx.length > 0) {
    const strips: Buffer[] = [];
    for (const i of retryIdx) for (const pos of RETRY_POSITIONS) strips.push(stripAt(targets[i], pos));
    const retryTexts = (await ocrSubtitleStrips(strips)) ?? [];
    retryIdx.forEach((i, k) => {
      ocrTexts[i].push(...retryTexts.slice(k * RETRY_POSITIONS.length, (k + 1) * RETRY_POSITIONS.length));
    });
  }

  const observations: TelopObservation[] = targets.map((t, i) => ({
    voiceFile: t.name,
    expected: t.expected,
    submissionStartSec: t.startSec,
    ocrTexts: ocrTexts[i],
  }));

  return { checks: checkTelops(observations), observations, skippedReason: null };
}
