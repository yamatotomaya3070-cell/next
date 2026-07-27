/**
 * ローカル動作確認用CLI: 動画案件パイプラインをDBなしで一気通貫実行する。
 *
 * 使い方:
 *   npx tsx scripts/video/generate-video-case.ts <templateType> "テーマ" [尺秒] [--mock] [--broll] [--kw="a,b,c"]
 * 例:
 *   npx tsx scripts/video/generate-video-case.ts business_explainer "在庫管理の基本" 90 --mock
 *   # 実写Bロール背景（要 PEXELS_API_KEY）。英語キーワードのほうが実写がヒットしやすい:
 *   npx tsx scripts/video/generate-video-case.ts business_explainer "在庫管理" 60 --mock --broll --kw="warehouse inventory,logistics workers,barcode scanner"
 */
import { join } from "node:path";
import { loadEnvLocal } from "./env";
import { runPipeline } from "./pipeline";
import { isTemplateImplemented, getTemplateConfig, type VideoTemplateType } from "../../src/lib/video/templates";

async function main() {
  loadEnvLocal();
  const rawArgs = process.argv.slice(2);
  const kwArg = rawArgs.find((a) => a.startsWith("--kw="));
  const args = rawArgs.filter((a) => !a.startsWith("--"));
  const useMock = rawArgs.includes("--mock");
  const useBroll = rawArgs.includes("--broll");
  const brollKeywords = kwArg
    ? kwArg.slice("--kw=".length).split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const templateType = (args[0] ?? "character_explainer") as VideoTemplateType;
  const theme = args[1] ?? "スマートフォンの歴史";
  const targetDurationSec = Number(args[2] ?? getTemplateConfig(templateType).durationRange.default);

  if (!isTemplateImplemented(templateType)) {
    console.error(`テンプレート ${templateType} は未実装です`);
    process.exit(1);
  }

  const workdir = join("scripts", "output", `video-case-${templateType}`);
  console.log(`テンプレート: ${templateType} / テーマ: ${theme} / 目標尺: ${targetDurationSec}秒 / provider: ${useMock ? "mock" : "auto"}`);

  const result = await runPipeline({
    templateType,
    theme,
    targetDurationSec,
    workdir,
    provider: useMock ? "mock" : "auto",
    useBroll,
    brollKeywords,
    onStage: (stage, progress) => console.log(`[${progress}%] ${stage}`),
  });

  console.log("--- 完了 ---");
  console.log(`台本: ${result.script.title}（${result.script.scenes.length}シーン, provider=${result.provider}）`);
  console.log(`実測尺: ${result.timeline.totalDurationSec}秒`);
  console.log(`完成見本: ${result.videoPath}`);
  if (result.rawTakeVideoPath) console.log(`未編集動画: ${result.rawTakeVideoPath}`);
  console.log(`素材ZIP: ${result.pkg.zipPath}`);
  console.log(`素材数: ${result.pkg.assetFiles.length}`);
  if (result.brollCredits.length > 0) {
    console.log(`実写Bロール: ${result.brollCredits.length}クリップ使用（credits: broll_credits.txt）`);
  }
}

main().catch((err) => {
  console.error("生成に失敗しました:", err);
  process.exit(1);
});
