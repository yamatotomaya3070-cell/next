// 提出動画の機械検品・自動採点の型。
// 「正解データ(TemplateAnswerData)」と「実測値(ProbeResult)」を突き合わせて
// CheckResult(項目別pass/fail + 自動採点)を作るのが compare.ts / score.ts の役割。

export interface ProbeResult {
  durationSec: number;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  meanVolumeDb: number | null;
}

export type CheckStatus = "pass" | "fail" | "unknown";

export interface CheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  expected: string;
  actual: string;
}

export interface CheckResult {
  checks: CheckItem[];
  autoScore: number;
}
