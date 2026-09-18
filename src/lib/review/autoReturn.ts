import type { CheckResult, SelfCheckItem } from "@/lib/types";

/**
 * 自動差し戻しの判定。
 *
 * 方針: 「事実として確定しているNG」だけで差し戻す。
 * AIのテキスト採点スコア（gradeSubmission）は動画の中身を見ずに
 * セルフチェック・コメント・作業時間だけで付けた点数なので、
 * これを根拠に差し戻すと誤差し戻しになる。就労者を無用に傷つけないため、
 * スコアは判定に使わない（職員レビューの参考値としてのみ残す）。
 */

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".m4v", ".wmv"] as const;

export interface AutoReturnInput {
  /** 提出時のセルフチェック回答 */
  selfCheck: SelfCheckItem[];
  /** 提出ファイル名（拡張子の確認に使う） */
  fileName: string | null;
  /** 機械検品の結果。まだ検品していない場合は null */
  checkResult: CheckResult | null;
}

export interface AutoReturnDecision {
  /** true なら利用者へ自動で差し戻す */
  shouldReturn: boolean;
  /** 利用者にそのまま見せる、やさしい日本語の理由 */
  reasons: string[];
}

function hasVideoExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** 提出内容から自動差し戻しの要否を決める（純関数・副作用なし） */
export function decideAutoReturn(input: AutoReturnInput): AutoReturnDecision {
  const reasons: string[] = [];

  if (input.fileName && !hasVideoExtension(input.fileName)) {
    reasons.push(
      `提出されたファイル「${input.fileName}」が動画ではないようです。DaVinci で書き出した mp4 ファイルを提出してください。`,
    );
  }

  const unchecked = input.selfCheck.filter((c) => !c.checked);
  for (const item of unchecked) {
    reasons.push(
      `「${item.item}」のチェックがまだです。確認できたらチェックを入れて、もう一度提出してください。`,
    );
  }

  for (const check of input.checkResult?.checks ?? []) {
    if (check.status !== "fail") continue;
    reasons.push(
      `${check.label}が見本と違います（あなたの動画: ${check.actual} / 見本: ${check.expected}）。`,
    );
  }

  return { shouldReturn: reasons.length > 0, reasons };
}

/** 差し戻し時に利用者へ見せる総評（やさしい日本語・責めない書き方） */
export function autoReturnSummary(reasonCount: number): string {
  return reasonCount === 1
    ? "あと1つだけ直すところがあります。下の内容を直して、もう一度提出してください。"
    : `あと${reasonCount}つ直すところがあります。下の内容を直して、もう一度提出してください。`;
}
