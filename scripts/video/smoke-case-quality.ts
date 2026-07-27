/**
 * 案件生成（依頼文＋仕様書＋手順書）の品質スモーク（実機・実Gemini）。
 *
 * 実行:  npx tsx scripts/video/smoke-case-quality.ts
 * 前提:  .env.local に GEMINI_API_KEY。
 *
 * 目的: ジャンル対応・難易度連動・要確認事項を含む「実案件レベルの仕様書」が
 *       生成されるかを目視確認する（低難易度=具体的/親切、高難易度=曖昧で判断を残す）。
 */
import { loadEnvLocal } from "./env";
import { generateTask } from "../../src/lib/ai";

loadEnvLocal();

const CASES = [
  { theme: "地元カフェの新メニュー紹介", genre: "TikTokショート", difficulty: 2, skillTags: ["cut", "telop", "bgm"] },
  { theme: "在庫管理クラウドの使い方解説", genre: "YouTube解説", difficulty: 4, skillTags: ["cut", "telop", "image", "bgm"] },
];

async function main(): Promise<void> {
  for (const c of CASES) {
    console.log("\n==================================================");
    console.log(`テーマ: ${c.theme} / ジャンル: ${c.genre} / 難易度: ${c.difficulty}`);
    console.log("==================================================");
    const r = await generateTask(c);
    console.log(`provider: ${r.provider}`);
    if (r.provider.startsWith("mock")) {
      throw new Error("Geminiが使われずmockにフォールバックしました（API/キーを確認）");
    }
    console.log(`\n【title】${r.title}`);
    console.log("\n----- requestDoc（依頼文＋仕様書）-----\n" + r.requestDoc);
    console.log("\n----- manualSteps（手順書）-----");
    r.manualSteps.forEach((s, i) => console.log(`${i + 1}. ${s.text}${s.tip ? `  💡${s.tip}` : ""}`));
    console.log("\n----- selfCheckItems -----");
    r.selfCheckItems.forEach((s) => console.log(`- ${s}`));
  }
  console.log("\n✅ 案件品質スモーク完了（内容は目視で確認）");
}

main().catch((err) => {
  console.error("❌ 失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
