import type { CheckItem } from "./types";
import { formatSec, voiceDisplayName } from "./structure";

/**
 * セリフ字幕（テロップ）の照合。純関数。
 *
 * 就労者は「作業指示一覧」のセリフ文をコピーして字幕を付ける。
 * 提出動画の、各セリフが流れている時刻の画面下部を文字認識（OCR）した結果を受け取り、
 *   - 字幕の入れ忘れ（そのセリフの間、画面下部に文字が無い）
 *   - 字幕の文言違い（指示の文と明らかに違う）
 * を項目別の pass/fail にする。OCR は読み間違いがあるため、
 * 「明らかに違う」ときだけ fail、微妙なときは unknown（職員に見てもらう）にする。
 */

export interface TelopExpectation {
  /** 音声ファイル名（S01_02_ミナ先生.wav） */
  voiceFile: string;
  /** 指示された字幕の文 */
  text: string;
}

export interface TelopObservation {
  voiceFile: string;
  expected: string;
  /** 提出動画でそのセリフが始まる秒（利用者への案内用） */
  submissionStartSec: number;
  /** そのセリフの間に撮った画面下部の OCR 結果（複数フレーム）。空文字=文字なし */
  ocrTexts: string[];
}

/** 文言が「同じ」とみなす類似度 */
export const TELOP_MATCH_SIMILARITY = 0.85;
/** これ未満なら「明らかに違う」 */
export const TELOP_WRONG_SIMILARITY = 0.5;

// ---------------------------------------------------------------------------
// 作業指示一覧の読み取り（CSV と Markdown 表の両方に対応）
// ---------------------------------------------------------------------------

const VOICE_FILE_RE = /S\d{2}_\d{2}_[^|",/\\]+?\.wav/i;

/** CSV 1行を分解する（ダブルクォート内のカンマと "" エスケープに対応） */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * 作業指示一覧（作業指示一覧.csv または app_task.json の timelineMd）から
 * 「音声ファイル → 字幕の文」を取り出す。どちらの形式か分からなくても使える。
 */
export function parseTelopExpectations(source: string): TelopExpectation[] {
  const text = source.replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: TelopExpectation[] = [];
  const seen = new Set<string>();

  // CSV: ヘッダ行に「セリフ」列と音声の列がある
  const headerIdx = lines.findIndex((l) => /セリフ/.test(l) && /音声/.test(l) && !l.trim().startsWith("|"));
  if (headerIdx >= 0) {
    const header = splitCsvLine(lines[headerIdx]).map((h) => h.trim());
    const textCol = header.findIndex((h) => /^セリフ/.test(h));
    const voiceCol = header.findIndex((h) => /音声/.test(h));
    if (textCol >= 0 && voiceCol >= 0) {
      for (const line of lines.slice(headerIdx + 1)) {
        const cells = splitCsvLine(line);
        const voice = VOICE_FILE_RE.exec(cells[voiceCol] ?? "")?.[0];
        const t = (cells[textCol] ?? "").trim();
        if (!voice || !t || seen.has(voice)) continue;
        seen.add(voice);
        out.push({ voiceFile: voice, text: t });
      }
      if (out.length > 0) return out;
    }
  }

  // Markdown 表: | 順番 | 話す人 | 使う音声 | セリフ | ... | の形。音声セルの次のセルが字幕の文
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
    const voiceIdx = cells.findIndex((c) => VOICE_FILE_RE.test(c));
    if (voiceIdx < 0 || voiceIdx + 1 >= cells.length) continue;
    const voice = VOICE_FILE_RE.exec(cells[voiceIdx])![0];
    const t = cells[voiceIdx + 1];
    if (!t || seen.has(voice)) continue;
    seen.add(voice);
    out.push({ voiceFile: voice, text: t });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 文字列の正規化と類似度
// ---------------------------------------------------------------------------

/** 記号・空白・全角半角の違いを無視して比べるための正規化 */
export function normalizeTelop(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .replace(/[、。，．,.!！?？「」『』（）()［］\[\]…・〜~ー\-—:：;；"'“”‘’]/g, "")
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** 0..1。1 なら同じ文 */
export function telopSimilarity(expected: string, actual: string): number {
  const a = normalizeTelop(expected);
  const b = normalizeTelop(actual);
  if (a.length === 0 && b.length === 0) return 1;
  const max = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / max;
}

/** OCR が話者名ラベル（字幕の上の小さい文字）まで拾ったときに取り除く */
function stripSpeakerLabel(ocr: string, voiceFile: string): string {
  const speaker = /^S\d{2}_\d{2}_(.+?)\.wav$/i.exec(voiceFile)?.[1];
  if (!speaker) return ocr;
  const trimmed = ocr.trim();
  return trimmed.startsWith(speaker) ? trimmed.slice(speaker.length).trim() : trimmed;
}

// ---------------------------------------------------------------------------
// 判定
// ---------------------------------------------------------------------------

export interface TelopJudgement {
  voiceFile: string;
  expected: string;
  bestOcr: string;
  similarity: number;
  verdict: "match" | "doubtful" | "wrong" | "missing";
}

/** 1セリフ分の OCR 結果（複数フレーム）を判定する */
export function judgeTelop(obs: TelopObservation): TelopJudgement {
  const candidates = obs.ocrTexts.map((t) => stripSpeakerLabel(t, obs.voiceFile)).filter((t) => normalizeTelop(t).length > 0);
  if (candidates.length === 0) {
    return { voiceFile: obs.voiceFile, expected: obs.expected, bestOcr: "", similarity: 0, verdict: "missing" };
  }
  let best = candidates[0];
  let bestSim = telopSimilarity(obs.expected, best);
  for (const c of candidates.slice(1)) {
    const s = telopSimilarity(obs.expected, c);
    if (s > bestSim) {
      best = c;
      bestSim = s;
    }
  }
  const verdict = bestSim >= TELOP_MATCH_SIMILARITY ? "match" : bestSim < TELOP_WRONG_SIMILARITY ? "wrong" : "doubtful";
  return { voiceFile: obs.voiceFile, expected: obs.expected, bestOcr: best, similarity: bestSim, verdict };
}

function listWithTime(items: TelopObservation[], max = 4): string {
  const shown = items
    .slice(0, max)
    .map((o) => `${voiceDisplayName(o.voiceFile)}: ${formatSec(o.submissionStartSec)}あたり`)
    .join("、");
  return items.length > max ? `${shown} ほか${items.length - max}件` : shown;
}

const shorten = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function checkTelops(observations: TelopObservation[]): CheckItem[] {
  if (observations.length === 0) {
    const unknown = (key: string, label: string): CheckItem => ({
      key,
      label,
      status: "unknown",
      expected: "－",
      actual: "字幕を確認できるセリフがありませんでした",
    });
    return [unknown("telop_present", "字幕の入れ忘れ"), unknown("telop_text", "字幕の文")];
  }

  const judged = observations.map((o) => ({ obs: o, j: judgeTelop(o) }));
  const missing = judged.filter((x) => x.j.verdict === "missing");
  const wrong = judged.filter((x) => x.j.verdict === "wrong");
  const doubtful = judged.filter((x) => x.j.verdict === "doubtful");
  const total = observations.length;

  const present: CheckItem = {
    key: "telop_present",
    label: "字幕の入れ忘れ",
    status: missing.length === 0 ? "pass" : "fail",
    expected: `${total}本すべてに字幕`,
    actual:
      missing.length === 0
        ? `${total}本すべてに字幕があります`
        : `${total - missing.length}本（字幕なし: ${listWithTime(missing.map((x) => x.obs))}）`,
    message:
      missing.length === 0
        ? undefined
        : `字幕が入っていないセリフが${missing.length}本あります（${listWithTime(missing.map((x) => x.obs))}）。作業指示一覧の文をコピーして、声と同じ長さで入れてください。`,
  };

  const checked = total - missing.length;
  const wrongDesc = wrong
    .slice(0, 3)
    .map((x) => `${voiceDisplayName(x.obs.voiceFile)}「${shorten(x.j.bestOcr)}」→指示「${shorten(x.obs.expected)}」`)
    .join("、");
  const doubtfulDesc = doubtful
    .slice(0, 3)
    .map((x) => `${voiceDisplayName(x.obs.voiceFile)}（一致度${Math.round(x.j.similarity * 100)}%）`)
    .join("、");

  const text: CheckItem = {
    key: "telop_text",
    label: "字幕の文",
    status: wrong.length > 0 ? "fail" : doubtful.length > 0 ? "unknown" : "pass",
    expected: "作業指示一覧と同じ文",
    actual:
      wrong.length > 0
        ? `文が違う: ${wrongDesc}${wrong.length > 3 ? ` ほか${wrong.length - 3}件` : ""}`
        : doubtful.length > 0
          ? `${checked - doubtful.length}本は一致。要確認: ${doubtfulDesc}${doubtful.length > 3 ? ` ほか${doubtful.length - 3}件` : ""}`
          : `${checked}本すべて一致`,
    message:
      wrong.length > 0
        ? `字幕の文が作業指示一覧と違うところがあります（${wrong
            .slice(0, 3)
            .map((x) => `${voiceDisplayName(x.obs.voiceFile)}: ${formatSec(x.obs.submissionStartSec)}あたり`)
            .join("、")}）。作業指示一覧の文をそのままコピーして貼り直してください。`
        : undefined,
  };

  return [present, text];
}
