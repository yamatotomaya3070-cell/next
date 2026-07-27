/**
 * ストック動画プロバイダのディスパッチ層。
 * パイプライン/スクリプトはここが返す StockProvider だけに依存し、具体的な
 * プロバイダ（Pexels 等）を意識しない。プロバイダ追加時はここに分岐を足すだけ。
 */
import type { StockProvider } from "./types";
import { createPexelsProvider } from "./pexels";

export * from "./types";

/** ストック動画が利用可能か（いずれかのプロバイダのキーが設定済みか） */
export function isStockConfigured(): boolean {
  return Boolean(process.env.PEXELS_API_KEY);
}

/**
 * 設定済みのストックプロバイダを返す。未設定なら例外。
 * 優先順: PEXELS_API_KEY（今後プロバイダを増やす場合はここに追加）。
 */
export function getStockProvider(): StockProvider {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) return createPexelsProvider(pexelsKey);
  throw new Error(
    "ストック動画プロバイダが未設定です。PEXELS_API_KEY を設定してください。",
  );
}
