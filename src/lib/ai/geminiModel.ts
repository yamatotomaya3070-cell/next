/**
 * 文章を作る Gemini の既定モデル。設定ファイルに GEMINI_MODEL が無いときに使う。
 * 提供が終わったモデルを既定にしていると、設定が3項目だけのPC（ワーカーPC）で生成が失敗する。
 * 変えるときは scripts/scene/checkWorkerSetup.ts の確認（実際に1回呼ぶ）が通ることを確かめる。
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function geminiTextModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}
