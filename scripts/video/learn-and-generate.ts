/**
 * 【Loop A 実証】動画→編集パターン学習→実CW水準の案件生成 の一連を通す。
 *
 * 実行: npx tsx scripts/video/learn-and-generate.ts <動画パス> ["テーマ"]
 * 前提: .env.local に GEMINI_API_KEY（動画対応モデル gemini-2.5-flash）。
 *
 * ① 参考/実CW動画を Gemini で解析し編集パターンを抽出
 * ② そのパターンを generateTask に注入して練習案件を生成
 * → 生成される仕様書・手順書が「動画から学んだテンポ・テロップ量・構成」に沿うことを確認
 */
import { readFileSync } from "node:fs";
import { loadEnvLocal } from "./env";
import { analyzeVideo, editingPatternToPromptBlock } from "../../src/lib/video/analysis";
import { generateTask } from "../../src/lib/ai";

loadEnvLocal();

async function main(): Promise<void> {
  const videoPath = process.argv[2];
  if (!videoPath) throw new Error("動画パスを指定してください");
  const theme = process.argv[3] ?? "在庫管理の基本";

  console.log("① 参考動画を解析中...");
  const base64 = readFileSync(videoPath).toString("base64");
  const pattern = await analyzeVideo({ videoBase64: base64, mimeType: "video/mp4", hint: theme });
  console.log(
    `   provider=${pattern.provider} / genre=${pattern.genre} / ` +
      `テンポ=${pattern.pacing}(約${pattern.estimatedCutsPerMinute}カット/分) / テロップ量=${pattern.telop.density}`,
  );
  console.log(`   構成: ${pattern.structure.join(" → ")}`);

  console.log("\n② この編集パターンを注入して練習案件を生成中...");
  const task = await generateTask({
    theme,
    genre: pattern.genre,
    difficulty: 3,
    skillTags: ["cut", "telop", "bgm", "image"],
    editingPatternContext: editingPatternToPromptBlock(pattern),
  });
  if (task.provider.startsWith("mock")) {
    throw new Error("案件生成がmockにフォールバックしました（APIを確認）");
  }
  console.log(`   provider=${task.provider}`);

  console.log("\n===== 生成された依頼書＋案件仕様書 =====\n" + task.requestDoc);
  console.log("\n===== 手順書 =====");
  task.manualSteps.forEach((s, i) => console.log(`${i + 1}. ${s.text}`));

  console.log("\n✅ 動画→編集パターン学習→実CW水準の案件生成 の一連が動作");
}

main().catch((err) => {
  console.error("❌ 失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
