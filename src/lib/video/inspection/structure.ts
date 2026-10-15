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
  /** セリフ音声の長さ（秒）。短いセリフの見つけ損ないを差し戻し理由にしないために使う */
  durationSec?: number;
  /** 完成見本の中で見つけたときのスコア。低いセリフは提出側でも見つけ損ないやすい */
  sampleScore?: number;
  /**
   * 提出動画で「一致」の基準には届かないが、それらしい場所はあった（ゆるい基準での一致）。
   * BGM が大きい・音声の端を切った・書き出しで音が変わった、などで基準を少し下回ったもの。
   */
  nearMiss?: { startSec: number; score: number; coverage: number };
}

/**
 * これ以下の長さのセリフ（「はい。」など）は音声指紋の手がかりが少なく、
 * 再エンコード後に見つけ損なうことがある。見つからなくても差し戻さず職員確認にする
 */
export const SHORT_VOICE_SEC = 1.5;

/** 見本の中でもこれより低いスコアでしか見つからないセリフは、提出側で見つからなくても差し戻さない */
export const WEAK_SAMPLE_SCORE = 0.5;

/** ゆるい基準の候補を「入っている」とみなすのに要るカバー率（セリフのほぼ全体で一致している） */
export const NEAR_MISS_MIN_COVERAGE = 0.85;
/** ゆるい基準の候補が、前後のセリフから予想される位置とこれ以内なら「入っている」とみなす（秒） */
export const NEAR_MISS_POSITION_TOLERANCE_SEC = 1.0;

/**
 * 基準に少し届かなかったセリフでも、ほぼ全体が一致し、前後のセリフ（確かに見つかったもの）から
 * 予想される位置にあるなら、入っているとみなす。書き出しで音が少し変わると、全部のセリフの
 * スコアが一様に下がり、基準ぎりぎりのセリフだけが「入っていない」と誤判定されていた（2026-10-09 の提出）。
 */
export function confirmNearMisses(voices: VoicePlacement[]): VoicePlacement[] {
  const ordered = voices
    .filter((v): v is VoicePlacement & { sampleStartSec: number } => v.sampleStartSec !== null)
    .sort((a, b) => a.sampleStartSec - b.sampleStartSec);
  const offsetOf = (v: VoicePlacement & { sampleStartSec: number }) =>
    v.submissionStarts.length === 1 ? v.submissionStarts[0] - v.sampleStartSec : null;

  const confirmed = new Map<string, number>();
  ordered.forEach((v, i) => {
    const near = v.nearMiss;
    if (v.submissionStarts.length > 0 || !near || near.coverage < NEAR_MISS_MIN_COVERAGE) return;
    const prev = ordered.slice(0, i).reverse().map(offsetOf).find((o) => o !== null) ?? null;
    const next = ordered.slice(i + 1).map(offsetOf).find((o) => o !== null) ?? null;
    const neighbors = [prev, next].filter((o): o is number => o !== null);
    if (neighbors.length === 0) return;
    const expected = v.sampleStartSec + neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
    if (Math.abs(near.startSec - expected) <= NEAR_MISS_POSITION_TOLERANCE_SEC) confirmed.set(v.name, near.startSec);
  });

  return voices.map((v) => {
    const start = confirmed.get(v.name);
    return start === undefined ? v : { ...v, submissionStarts: [start] };
  });
}

/** 見つけ損ないの理由になりうるもの（どれかに当たれば差し戻さず、職員が聞いて確かめる） */
function isUncertainMiss(v: VoicePlacement): boolean {
  if (v.durationSec !== undefined && v.durationSec <= SHORT_VOICE_SEC) return true;
  if (v.sampleScore !== undefined && v.sampleScore < WEAK_SAMPLE_SCORE) return true;
  return v.nearMiss !== undefined;
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

export function checkVoiceStructure(input: VoicePlacement[]): CheckItem[] {
  const voices = confirmNearMisses(input);
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
  const missingVoices = known.filter((v) => v.submissionStarts.length === 0);
  const missing = missingVoices.map((v) => v.name);
  const found = known.length - missing.length;
  const key = "voice_present";
  const label = "セリフの入れ忘れ";
  const expected = `${known.length}本すべて`;
  if (missing.length === 0) {
    return { key, label, status: "pass", expected, actual: `${found}本すべて入っています` };
  }
  // 自動の聞き取りで見つけ損なった可能性があるもの（短い・見本でも弱い・それらしい場所はある）は
  // 「入っていない」と決めつけず、職員が聞いて確かめる。はっきり無いものだけを差し戻す
  const certain = missingVoices.filter((v) => !isUncertainMiss(v)).map((v) => v.name);
  const uncertain = missingVoices.filter(isUncertainMiss).map((v) => v.name);
  if (certain.length === 0) {
    return {
      key,
      label,
      status: "unknown",
      expected,
      actual: `${found}本（自動では確認できず: ${listNames(uncertain)}。入っているか職員が聞いて確かめてください）`,
    };
  }
  const also = uncertain.length > 0 ? `／確認できず: ${listNames(uncertain)}` : "";
  return {
    key,
    label,
    status: "fail",
    expected,
    actual: `${found}本（足りない: ${listNames(certain)}${also}）`,
    message: `セリフの音声が${certain.length}本入っていません（${listNames(certain)}）。「素材」フォルダの音声をもう一度並べて、聞こえるか確かめてください。`,
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
