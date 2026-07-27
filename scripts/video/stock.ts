/**
 * ストック動画のダウンロード（node/ワーカー側）。
 * 検索は src/lib/video/stock（プロバイダ非依存）が担当し、ここは取得URLの
 * ダウンロードとローカル保存だけを行う。ffmpeg変換や配置は pipeline 側の責務。
 */
import { writeFileSync } from "node:fs";

const DOWNLOAD_TIMEOUT_MS = 120_000;

/** ストック動画URLをダウンロードして destPath に保存する */
export async function downloadStockFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`ストック動画のダウンロードに失敗 (${res.status}): ${url.slice(0, 120)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("ストック動画のダウンロード結果が空でした");
  }
  writeFileSync(destPath, buffer);
}
