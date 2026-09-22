import type { CheckStatus } from "./types";

/**
 * 検品の精度測定（純関数）。
 *
 * 「わざとミスを入れた提出」ごとに、NG になるべき項目（expectedFails）と実際の判定を突き合わせ、
 * 項目別の 見逃し／誤検知／職員確認行き を数える。提出単位では「自動差し戻しされるべきか」と
 * 「実際に差し戻されたか（fail が1つでもあるか）」を比べる。
 */

export interface OutcomeCheck {
  key: string;
  label: string;
  status: CheckStatus;
  /** 実測の説明（診断用。集計には使わない） */
  actual?: string;
}

export interface VariantOutcome {
  packageName: string;
  variantId: string;
  title: string;
  /** NG になるべき項目 */
  expectedFails: string[];
  /** NG になっても誤検知に数えない項目 */
  allowedExtra: string[];
  checks: OutcomeCheck[];
  elapsedSec: number;
}

export interface KeyStats {
  key: string;
  label: string;
  /** NG になるべきで、NG になった */
  tp: number;
  /** NG になるべきでないのに、NG になった（誤検知） */
  fp: number;
  /** NG になるべきなのに、OK になった（見逃し） */
  fn: number;
  /** NG になるべきなのに、職員確認（unknown）になった */
  unknownExpected: number;
  /** NG になるべきでないのに、職員確認（unknown）になった */
  unknownUnexpected: number;
}

export interface SubmissionStats {
  total: number;
  /** 差し戻されるべき提出の数 */
  shouldReturn: number;
  /** 差し戻されるべきで、差し戻された */
  tp: number;
  /** 差し戻されるべきでないのに、差し戻された */
  fp: number;
  /** 差し戻されるべきなのに、差し戻されなかった */
  fn: number;
}

export interface AccuracySummary {
  keys: KeyStats[];
  submissions: SubmissionStats;
  totalElapsedSec: number;
}

function isReturned(o: VariantOutcome): boolean {
  return o.checks.some((c) => c.status === "fail");
}

export function summarizeAccuracy(outcomes: VariantOutcome[]): AccuracySummary {
  const keyMap = new Map<string, KeyStats>();
  const statsOf = (key: string, label: string): KeyStats => {
    const existing = keyMap.get(key);
    if (existing) return existing;
    const created: KeyStats = { key, label, tp: 0, fp: 0, fn: 0, unknownExpected: 0, unknownUnexpected: 0 };
    keyMap.set(key, created);
    return created;
  };

  const submissions: SubmissionStats = { total: 0, shouldReturn: 0, tp: 0, fp: 0, fn: 0 };
  let totalElapsedSec = 0;

  for (const o of outcomes) {
    const expected = new Set(o.expectedFails);
    const allowed = new Set(o.allowedExtra);
    for (const c of o.checks) {
      const s = statsOf(c.key, c.label);
      if (expected.has(c.key)) {
        if (c.status === "fail") s.tp++;
        else if (c.status === "unknown") s.unknownExpected++;
        else s.fn++;
      } else if (!allowed.has(c.key)) {
        if (c.status === "fail") s.fp++;
        else if (c.status === "unknown") s.unknownUnexpected++;
      }
    }
    // 判定項目に現れなかった期待キー（項目そのものが無い）は見逃しに数える
    const presentKeys = new Set(o.checks.map((c) => c.key));
    for (const key of expected) {
      if (!presentKeys.has(key)) statsOf(key, key).fn++;
    }

    submissions.total++;
    const shouldReturn = expected.size > 0;
    const returned = isReturned(o);
    if (shouldReturn) submissions.shouldReturn++;
    if (shouldReturn && returned) submissions.tp++;
    else if (!shouldReturn && returned) submissions.fp++;
    else if (shouldReturn && !returned) submissions.fn++;
    totalElapsedSec += o.elapsedSec;
  }

  return { keys: [...keyMap.values()], submissions, totalElapsedSec };
}

function ratio(num: number, den: number): string {
  return den === 0 ? "－" : `${Math.round((num / den) * 100)}%`;
}

function mark(o: VariantOutcome): "○" | "△" | "✗" {
  const expected = new Set(o.expectedFails);
  const allowed = new Set(o.allowedExtra);
  const fails = o.checks.filter((c) => c.status === "fail").map((c) => c.key);
  const missed = [...expected].filter((k) => !fails.includes(k));
  const extra = fails.filter((k) => !expected.has(k) && !allowed.has(k));
  if (missed.length === 0 && extra.length === 0) return "○";
  // 差し戻し判定（提出単位）は合っているが、項目が一部ずれている
  const shouldReturn = expected.size > 0;
  return shouldReturn === isReturned(o) ? "△" : "✗";
}

export function renderAccuracyMarkdown(outcomes: VariantOutcome[], summary: AccuracySummary, generatedAt: Date): string {
  const lines: string[] = [];
  const s = summary.submissions;
  lines.push(`# 提出後AI検品の精度測定`);
  lines.push("");
  lines.push(`生成日時: ${generatedAt.toISOString()}　提出動画: ${s.total}本　合計処理時間: ${Math.round(summary.totalElapsedSec)}秒`);
  lines.push("");
  lines.push(`## 提出単位（自動差し戻しの判定）`);
  lines.push("");
  lines.push(`| 差し戻すべき | 正しく差し戻した | 誤って差し戻した | 見逃した | 再現率 | 適合率 |`);
  lines.push(`|---|---|---|---|---|---|`);
  lines.push(`| ${s.shouldReturn} | ${s.tp} | ${s.fp} | ${s.fn} | ${ratio(s.tp, s.shouldReturn)} | ${ratio(s.tp, s.tp + s.fp)} |`);
  lines.push("");
  lines.push(`## 項目別`);
  lines.push("");
  lines.push(`| 項目 | 検出 | 誤検知 | 見逃し | 職員確認(NGのはず) | 職員確認(OKのはず) | 再現率 | 適合率 |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const k of summary.keys) {
    const expectedTotal = k.tp + k.fn + k.unknownExpected;
    lines.push(
      `| ${k.label} (${k.key}) | ${k.tp} | ${k.fp} | ${k.fn} | ${k.unknownExpected} | ${k.unknownUnexpected} | ${ratio(k.tp, expectedTotal)} | ${ratio(k.tp, k.tp + k.fp)} |`,
    );
  }
  lines.push("");
  lines.push(`## 提出ごとの結果`);
  lines.push("");
  lines.push(`○=期待どおり　△=差し戻し判定は正しいが項目にずれ　✗=差し戻し判定が違う`);
  lines.push("");
  lines.push(`| 判定 | パッケージ | 提出 | NGのはず | 実際のNG | 職員確認 | 秒 |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const o of outcomes) {
    const fails = o.checks.filter((c) => c.status === "fail").map((c) => c.key);
    const unknowns = o.checks.filter((c) => c.status === "unknown").map((c) => c.key);
    lines.push(
      `| ${mark(o)} | ${o.packageName} | ${o.title} | ${o.expectedFails.join(", ") || "なし"} | ${fails.join(", ") || "なし"} | ${unknowns.join(", ") || "なし"} | ${Math.round(o.elapsedSec)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
