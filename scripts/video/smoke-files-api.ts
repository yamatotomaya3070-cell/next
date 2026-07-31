/**
 * Gemini Files API 動画理解のスモークテスト（実API疎通）。
 *
 * ffmpeg を使わずに、既存の動画ファイルをそのまま Files API へアップロードし、
 * 編集パターンが抽出できることを確認する。GEMINI_API_KEY が必要。
 *
 * 実行:
 *   npx tsx scripts/video/smoke-files-api.ts [動画パス]
 * 既定パスは過去のテスト取り込みで残っている small.mp4。
 */
import { readFileSync, existsSync } from "node:fs";
import { loadEnvLocal } from "./env";
import { analyzeViaFilesApi } from "../../src/lib/video/analysis/geminiFiles";

loadEnvLocal();

const DEFAULT_VIDEO =
  "scripts/output/ingests/20535ec6-5a9d-4bf0-bc84-0371e8aaa20b/small.mp4";

async function main(): Promise<void> {
  const path = process.argv[2] || DEFAULT_VIDEO;
  if (!existsSync(path)) {
    console.error(`動画ファイルが見つかりません: ${path}`);
    console.error("別の動画パスを引数で渡してください。");
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY が未設定です（.env.local を確認してください）。");
    process.exit(1);
  }

  const bytes = new Uint8Array(readFileSync(path));
  console.log(`アップロード: ${path}（${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB）`);

  const started = Date.now();
  const pattern = await analyzeViaFilesApi({
    bytes,
    mimeType: "video/mp4",
    hint: "在庫管理の解説動画（スモークテスト）",
    displayName: "smoke-files-api",
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n解析完了（${elapsed}秒）:`);
  console.log(JSON.stringify(pattern, null, 2));

  const ok =
    typeof pattern.genre === "string" &&
    pattern.genre.length > 0 &&
    Array.isArray(pattern.structure);
  if (!ok) {
    console.error("\n結果の形が不正です。");
    process.exit(1);
  }
  console.log("\nPASS: Files API 経由で編集パターンを抽出できました。");
}

main().catch((err) => {
  console.error("スモークテスト失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
