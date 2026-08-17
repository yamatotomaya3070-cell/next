/**
 * 練習素材ジェネレーター（Stage2→Stage4）の統合スモーク。
 * モックで台本生成→3難易度でパッケージ組み立てを行い、難易度で出力が変わることを確認する。
 * DB/APIキー不要。実行: npx tsx scripts/video/smoke-practice-case.ts
 */
import { mockProvider } from "../../src/lib/ai/mock";
import { normalizeStyleGuide } from "../../src/lib/style-guide/schema";
import { allDifficultyProfiles } from "../../src/lib/practice-script/difficulty";
import { buildPracticeCasePackage } from "../../src/lib/practice-script/package";
import { validatePracticeScriptBalance } from "../../src/lib/practice-script/schema";

async function main() {
  const guide = normalizeStyleGuide({
    name: "スモーク",
    client: { channelName: "つなぐ雑学ラボ", clientName: "たけし" },
    characters: [
      { key: "ao", name: "アオ", seed: 1000 },
      { key: "midori", name: "ミドリ", seed: 2000 },
    ],
  });

  let allPass = true;
  for (const profile of allDifficultyProfiles()) {
    const script = await mockProvider.generatePracticeScript({
      styleGuide: guide,
      theme: "在宅ワークの始め方",
      difficulty: profile.scriptDifficulty,
      targetKeepMinutes: 10,
    });
    const pkg = buildPracticeCasePackage(script, profile, guide);
    const warnings = validatePracticeScriptBalance(script);
    const revealsCuts = pkg.workInstructions.some((s) => s.includes("clip_"));

    console.log(`--- ${profile.tier} (${profile.label}) ---`);
    console.log(`素材 ${pkg.materials.length}本 / 残す ${pkg.stats.mustCount} / 切る候補 ${pkg.stats.optionalCount}`);
    console.log(`許容誤差 ±${pkg.answerData.toleranceSec}秒 / 切る素材の明示: ${revealsCuts ? "あり" : "なし"}`);
    console.log(`バランス警告: ${warnings.length === 0 ? "なし" : warnings.join(" / ")}`);

    const checks: Array<[string, boolean]> = [
      ["素材=全セグメント", pkg.materials.length === script.segments.length],
      ["正解データの残す本数が一致", pkg.answerData.mustSegmentIds.length === pkg.stats.mustCount],
      ["切る候補に理由がある", pkg.answerData.optionalSegmentIds.every((id) => id in pkg.answerData.cutReasonById)],
      ["beginnerのみ切る素材を明示", profile.revealCutTargets === revealsCuts],
      ["依頼書に依頼主名", pkg.requestDoc.includes("たけし")],
    ];
    for (const [label, ok] of checks) {
      if (!ok) {
        console.log(`  FAIL: ${label}`);
        allPass = false;
      }
    }
  }

  console.log("---");
  if (!allPass) {
    console.error("スモーク失敗");
    process.exit(1);
  }
  console.log("スモーク成功");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
