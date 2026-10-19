import { formatSec, SHORT_VOICE_SEC } from "./structure";
import type { CheckItem } from "./types";

/**
 * カット練習の案件の検品（純関数。ffmpeg や DB には触れない）。
 *
 * 受講者は録ったままの声を自分で切るので、提出は完成見本と同じ形にはならない。
 * そこで見本とは比べず、答え（編集ポイント.json）と比べて、機械で確かめられることだけを見る。
 *   - セリフの欠け（切りすぎ）・順番
 *   - 消し残し（わざと入れた「えー」や言い直しの声が残っていないか）
 *   - 長い間の残り
 *   - 場面ごとの声の大きさのばらつき（1場面だけ小さく録ってある）
 * カットの上手さ・テロップの見やすさなどの出来は、職員が見て決める。
 */

export interface CutLineObservation {
  scene: number;
  text: string;
  durationSec: number;
  /** 提出動画の中でこのセリフが始まる秒。見つからなければ null */
  startSec: number | null;
}

export interface RemnantObservation {
  /** 「えー」などの言いよどみ、など */
  kindJa: string;
  /** その声の文（えー、あ、すみません。もう一回いきます。など） */
  text: string;
  durationSec: number;
  /** 提出動画の中で見つかった所（残っていなければ空）。score は音声指紋の一致の強さ */
  found: { atSec: number; score: number }[];
}

export interface SceneLevel {
  scene: number;
  /**
   * この場面の声が、もとのきれいな声にくらべてどれだけの大きさで入っているか（dB）。
   * （提出での大きさ − 録ったままの声での大きさ ＋ 録るときに下げた分）のセリフごとの中央値。
   * どの場面も同じくらいなら、小さく録れた場面をきちんと上げてそろえてある。測れなければ null
   */
  db: number | null;
}

/** 同じ場面の中で、これより長い間は「長い沈黙が残っている」（秒） */
export const GAP_FAIL_SEC = 2.0;
export const GAP_DOUBT_SEC = 1.2;
/** 場面と場面の間は、場面の切りかえの間を見込んで長めにする（秒） */
export const SCENE_GAP_FAIL_SEC = 3.0;
export const SCENE_GAP_DOUBT_SEC = 2.0;
/** 場面ごとの声の大きさの差（dB） */
export const LEVEL_FAIL_DB = 4;
export const LEVEL_DOUBT_DB = 2.5;
/** これより短い消す声は、見つけ方の手がかりが少ないので、残っていても職員確認にする（秒） */
export const SHORT_REMNANT_SEC = 0.8;
/** 一致の強さがこれ以上なら「確かに残っている」。これ未満は似た声の見まちがいもありうるので職員確認（実測: 残っている声は 0.40〜1.33、別の声への見まちがいは 0.31） */
export const REMNANT_SURE_SCORE = 0.5;
/** 順番ちがいとみなす、さかのぼりの長さ（秒） */
const ORDER_TOLERANCE_SEC = 0.5;

const shorten = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n)}…` : s);
const lineName = (l: CutLineObservation) => `場面${l.scene}「${shorten(l.text)}」`;
const listUp = (xs: string[], max = 3) => (xs.length > max ? `${xs.slice(0, max).join("、")} ほか${xs.length - max}件` : xs.join("、"));

export function checkCutLines(lines: CutLineObservation[]): CheckItem {
  const missing = lines.filter((l) => l.startSec === null);
  const sure = missing.filter((l) => l.durationSec > SHORT_VOICE_SEC);
  const expected = `台本のセリフ ${lines.length}本がすべて入っている`;
  if (missing.length === 0) {
    return { key: "cut_lines", label: "セリフの欠け（切りすぎ）", status: "pass", expected, actual: `${lines.length}本すべてあります` };
  }
  const names = listUp(missing.map(lineName));
  return {
    key: "cut_lines",
    label: "セリフの欠け（切りすぎ）",
    status: sure.length > 0 ? "fail" : "unknown",
    expected,
    actual: `見つからないセリフ ${missing.length}本: ${names}`,
    message:
      sure.length > 0
        ? `台本のセリフが見つからない所があります（${names}）。必要な言葉まで切っていないか、聞いて確かめてください。`
        : undefined,
  };
}

export function checkCutOrder(lines: CutLineObservation[]): CheckItem {
  const found = lines.filter((l): l is CutLineObservation & { startSec: number } => l.startSec !== null);
  const swapped: string[] = [];
  for (let i = 1; i < found.length; i++) {
    if (found[i].startSec < found[i - 1].startSec - ORDER_TOLERANCE_SEC) swapped.push(`${lineName(found[i])}（${formatSec(found[i].startSec)}）`);
  }
  return {
    key: "cut_order",
    label: "セリフの順番",
    status: swapped.length === 0 ? "pass" : "fail",
    expected: "台本と同じ順番",
    actual: swapped.length === 0 ? "台本と同じ順番です" : `順番がちがう: ${listUp(swapped)}`,
    message: swapped.length === 0 ? undefined : `台本と順番がちがうセリフがあります（${listUp(swapped)}）。台本の順番に並べ直してください。`,
  };
}

export function checkRemnants(remnants: RemnantObservation[]): CheckItem {
  const left = remnants.filter((r) => r.found.length > 0);
  const sure = left.filter((r) => r.durationSec >= SHORT_REMNANT_SEC && r.found.some((f) => f.score >= REMNANT_SURE_SCORE));
  const expected = "言いよどみ・言い直しの声・録り始め／終わりの声が残っていない";
  if (left.length === 0) {
    return { key: "cut_remnants", label: "消し残し", status: "pass", expected, actual: "残っていません" };
  }
  const desc = listUp(
    left.flatMap((r) => r.found.map((f) => ({ t: f.atSec, r }))).sort((a, b) => a.t - b.t).map(({ t, r }) => `${formatSec(t)}あたりの「${shorten(r.text, 12)}」`),
    4,
  );
  return {
    key: "cut_remnants",
    label: "消し残し",
    status: sure.length > 0 ? "fail" : "unknown",
    expected,
    actual: `残っている: ${desc}`,
    message: sure.length > 0 ? `消し忘れた声があります（${desc}）。その所を切って、うしろを詰めてください。` : undefined,
  };
}

export function checkGaps(lines: CutLineObservation[]): CheckItem {
  const found = lines.filter((l): l is CutLineObservation & { startSec: number } => l.startSec !== null);
  const fails: string[] = [];
  const doubts: string[] = [];
  for (let i = 1; i < found.length; i++) {
    const prev = found[i - 1];
    const cur = found[i];
    const gap = cur.startSec - (prev.startSec + prev.durationSec);
    const sameScene = prev.scene === cur.scene;
    const [failAt, doubtAt] = sameScene ? [GAP_FAIL_SEC, GAP_DOUBT_SEC] : [SCENE_GAP_FAIL_SEC, SCENE_GAP_DOUBT_SEC];
    const desc = `${formatSec(prev.startSec + prev.durationSec)}あたり（${gap.toFixed(1)}秒）`;
    if (gap > failAt) fails.push(desc);
    else if (gap > doubtAt) doubts.push(desc);
  }
  const expected = `同じ場面の中の間は ${GAP_DOUBT_SEC}秒まで`;
  if (fails.length === 0 && doubts.length === 0) {
    return { key: "cut_gaps", label: "長い間の残り", status: "pass", expected, actual: "長すぎる間はありません" };
  }
  return {
    key: "cut_gaps",
    label: "長い間の残り",
    status: fails.length > 0 ? "fail" : "unknown",
    expected,
    actual: [fails.length ? `長すぎる: ${listUp(fails)}` : "", doubts.length ? `やや長い: ${listUp(doubts)}` : ""].filter(Boolean).join(" / "),
    message: fails.length > 0 ? `セリフとセリフの間が長すぎる所があります（${listUp(fails)}）。間を 0.2〜1秒くらいに詰めてください。` : undefined,
  };
}

export function checkVoiceLevels(levels: SceneLevel[]): CheckItem {
  const measured = levels.filter((l): l is SceneLevel & { db: number } => l.db !== null && Number.isFinite(l.db));
  const expected = `場面ごとの声の大きさの差が ${LEVEL_DOUBT_DB}dB 以内`;
  if (measured.length < 2) {
    return { key: "voice_level", label: "声の大きさのばらつき", status: "unknown", expected, actual: "測れる場面が足りませんでした" };
  }
  const sorted = [...measured].sort((a, b) => a.db - b.db);
  const quiet = sorted[0];
  const median = sorted[Math.floor(sorted.length / 2)].db;
  const spread = median - quiet.db;
  const actual = `場面${quiet.scene}の声が、ほかの場面より ${spread.toFixed(1)}dB 小さい`;
  const status = spread > LEVEL_FAIL_DB ? "fail" : spread > LEVEL_DOUBT_DB ? "unknown" : "pass";
  return {
    key: "voice_level",
    label: "声の大きさのばらつき",
    status,
    expected,
    actual: status === "pass" ? `差は ${spread.toFixed(1)}dB で、そろっています` : actual,
    message:
      status === "fail"
        ? `場面${quiet.scene}の声が、ほかの場面より小さいままです。ミキサーのメーターを見て、ほかの場面と同じくらいの大きさにそろえてください。`
        : undefined,
  };
}

export function checkCutPractice(input: {
  lines: CutLineObservation[];
  remnants: RemnantObservation[];
  levels: SceneLevel[];
}): CheckItem[] {
  return [
    checkCutLines(input.lines),
    checkCutOrder(input.lines),
    checkRemnants(input.remnants),
    checkGaps(input.lines),
    checkVoiceLevels(input.levels),
  ];
}
