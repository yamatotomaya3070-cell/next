import type { CheckItem } from "./types";

/**
 * セリフ音声の「構成照合」。
 *
 * 支給したセリフ音声（S01_02_ミナ先生.wav など）が、完成見本と提出動画のそれぞれ
 * どこに入っているか（fingerprint 照合の結果）を受け取り、
 *   - 入れ忘れ（見本にあるのに提出に無い）
 *   - 重複（同じセリフが2回以上）
 *   - 順番違い
 *   - 間隔のズレ（前のセリフからの間が見本と大きく違う）
 * を項目別の pass/fail にする。純関数。ffmpeg や DB には触れない。
 */

export interface VoicePlacement {
  /** 音声ファイル名（S02_03_ハル.wav） */
  name: string;
  /** 完成見本の中で始まる秒。見本の中で見つからなければ null（照合対象から外す） */
  sampleStartSec: number | null;
  /** 提出動画の中で始まる秒（複数なら重複使用）。昇順 */
  submissionStarts: number[];
}

/** 前のセリフからの間隔が、見本とこれ以上ズレていたら NG（秒） */
export const VOICE_GAP_TOLERANCE_SEC = 1.5;

/** S02_03_ハル.wav → S02_03（ハル） */
export function voiceDisplayName(fileName: string): string {
  const m = /^(S\d{2}_\d{2})_(.+?)\.wav$/i.exec(fileName);
  return m ? `${m[1]}（${m[2]}）` : fileName.replace(/\.wav$/i, "");
}

/** 372.4 → 6分12秒 */
export function formatSec(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

function listNames(names: string[], max = 5): string {
  const shown = names.slice(0, max).map(voiceDisplayName).join("、");
  return names.length > max ? `${shown} ほか${names.length - max}件` : shown;
}

export function checkVoiceStructure(voices: VoicePlacement[]): CheckItem[] {
  const known = voices
    .filter((v): v is VoicePlacement & { sampleStartSec: number } => v.sampleStartSec !== null)
    .sort((a, b) => a.sampleStartSec - b.sampleStartSec);

  if (known.length === 0) {
    const unknown = (key: string, label: string): CheckItem => ({
      key,
      label,
      status: "unknown",
      expected: "－",
      actual: "見本の中でセリフを見つけられませんでした",
    });
    return [
      unknown("voice_present", "セリフの入れ忘れ"),
      unknown("voice_duplicate", "セリフの重複"),
      unknown("voice_order", "セリフの順番"),
      unknown("voice_spacing", "セリフの間隔"),
    ];
  }

  return [
    checkPresent(known),
    checkDuplicate(known),
    checkOrder(known),
    checkSpacing(known),
  ];
}

type Known = VoicePlacement & { sampleStartSec: number };

function checkPresent(known: Known[]): CheckItem {
  const missing = known.filter((v) => v.submissionStarts.length === 0).map((v) => v.name);
  const found = known.length - missing.length;
  return {
    key: "voice_present",
    label: "セリフの入れ忘れ",
    status: missing.length === 0 ? "pass" : "fail",
    expected: `${known.length}本すべて`,
    actual: missing.length === 0 ? `${found}本すべて入っています` : `${found}本（足りない: ${listNames(missing)}）`,
    message:
      missing.length === 0
        ? undefined
        : `セリフの音声が${missing.length}本入っていません（${listNames(missing)}）。「素材」フォルダの音声をもう一度並べて、聞こえるか確かめてください。`,
  };
}

function checkDuplicate(known: Known[]): CheckItem {
  const dup = known.filter((v) => v.submissionStarts.length >= 2);
  return {
    key: "voice_duplicate",
    label: "セリフの重複",
    status: dup.length === 0 ? "pass" : "fail",
    expected: "各セリフ1回ずつ",
    actual:
      dup.length === 0
        ? "重複なし"
        : dup.map((v) => `${voiceDisplayName(v.name)}が${v.submissionStarts.length}回`).join("、"),
    message:
      dup.length === 0
        ? undefined
        : `同じセリフが2回以上入っています（${listNames(dup.map((v) => v.name))}）。重なっている方を消してください。`,
  };
}

function checkOrder(known: Known[]): CheckItem {
  const present = known.filter((v) => v.submissionStarts.length > 0);
  const outOfOrder: string[] = [];
  for (let i = 1; i < present.length; i++) {
    if (present[i].submissionStarts[0] < present[i - 1].submissionStarts[0]) {
      outOfOrder.push(present[i].name);
    }
  }
  return {
    key: "voice_order",
    label: "セリフの順番",
    status: outOfOrder.length === 0 ? "pass" : "fail",
    expected: "見本と同じ順番",
    actual: outOfOrder.length === 0 ? "見本と同じ順番" : `順番が違う: ${listNames(outOfOrder)}`,
    message:
      outOfOrder.length === 0
        ? undefined
        : `セリフの順番が見本と違います（${listNames(outOfOrder)}）。作業指示一覧の順番どおりに並べ直してください。`,
  };
}

function checkSpacing(known: Known[]): CheckItem {
  const problems: string[] = [];
  const messages: string[] = [];
  // 見本で隣り合うセリフ同士だけ比べる。間のセリフが抜けている場合は checkPresent が扱うので、
  // その前後の間隔は見ない（「入れ忘れ」と「間隔」で同じ原因を二重に指摘しないため）
  for (let i = 1; i < known.length; i++) {
    const prev = known[i - 1];
    const cur = known[i];
    if (prev.submissionStarts.length === 0 || cur.submissionStarts.length === 0) continue;
    const expectedGap = cur.sampleStartSec - prev.sampleStartSec;
    const actualGap = cur.submissionStarts[0] - prev.submissionStarts[0];
    const diff = actualGap - expectedGap;
    if (actualGap < 0 || Math.abs(diff) <= VOICE_GAP_TOLERANCE_SEC) continue; // 順番違いは checkOrder が扱う
    const direction = diff > 0 ? "長い" : "短い";
    problems.push(`${voiceDisplayName(prev.name)}→${voiceDisplayName(cur.name)} が${Math.abs(diff).toFixed(1)}秒${direction}`);
    messages.push(
      `${voiceDisplayName(cur.name)}の始まりが見本より${Math.abs(diff).toFixed(1)}秒${diff > 0 ? "遅い" : "早い"}です（あなたの動画では${formatSec(cur.submissionStarts[0])}あたり）`,
    );
  }
  return {
    key: "voice_spacing",
    label: "セリフの間隔",
    status: problems.length === 0 ? "pass" : "fail",
    expected: `見本との差 ±${VOICE_GAP_TOLERANCE_SEC}秒以内`,
    actual: problems.length === 0 ? "見本どおり" : problems.slice(0, 5).join("、") + (problems.length > 5 ? ` ほか${problems.length - 5}件` : ""),
    message:
      problems.length === 0
        ? undefined
        : `セリフの間隔が見本と違うところがあります。${messages.slice(0, 3).join("。")}。前後の素材の長さや、すき間を確かめてください。`,
  };
}
