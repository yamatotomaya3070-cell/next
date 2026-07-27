import type { CheckItem } from "./types";

const STATUS_POINTS: Record<CheckItem["status"], number> = {
  pass: 100,
  unknown: 50,
  fail: 0,
};

/** 項目別チェック結果から機械検品の自動採点(0-100)を算出する。unknownはpass/failの中間として扱う */
export function computeAutoScore(checks: CheckItem[]): number {
  if (checks.length === 0) return 0;
  const total = checks.reduce((sum, c) => sum + STATUS_POINTS[c.status], 0);
  return Math.round(total / checks.length);
}
