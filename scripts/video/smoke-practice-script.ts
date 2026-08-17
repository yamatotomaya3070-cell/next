/**
 * 練習用素材台本生成（Stage2）のスモークテスト。
 * 既定はモックプロバイダで決定的に検証（DB/APIキー不要）。
 * GEMINI_API_KEY があり `--real` を付けると実Geminiで疎通確認する。
 *
 * 実行: npx tsx scripts/video/smoke-practice-script.ts [--real]
 */
import { mockProvider } from "../../src/lib/ai/mock";
import { geminiProvider } from "../../src/lib/ai/gemini";
import { normalizeStyleGuide } from "../../src/lib/style-guide/schema";
import {
  practiceScriptStats,
  validatePracticeScriptBalance,
} from "../../src/lib/practice-script/schema";

async function main() {
  const useReal = process.argv.includes("--real");
  const provider = useReal && process.env.GEMINI_API_KEY ? geminiProvider : mockProvider;

  const styleGuide = normalizeStyleGuide({
    name: "スモーク用ガイド",
    client: {
      channelName: "つなぐ雑学ラボ",
      clientName: "たけし",
      persona: "きさくで丁寧な個人YouTuber",
      audience: "スマホで気軽に見る初心者層",
    },
    characters: [
      { key: "ao", name: "アオ", role: "進行役", subtitleColor: "#1677E8", seed: 1000 },
      { key: "midori", name: "ミドリ", role: "解説役", subtitleColor: "#2E9E5B", seed: 2000 },
    ],
  });

  console.log(`provider = ${provider.name}${useReal ? " (--real)" : ""}`);
  const script = await provider.generatePracticeScript({
    styleGuide,
    theme: "在宅ワークの始め方",
    difficulty: 3,
    targetKeepMinutes: 10,
  });

  const stats = practiceScriptStats(script);
  const warnings = validatePracticeScriptBalance(script);

  console.log("---");
  console.log(`title        : ${script.title}`);
  console.log(`episodeTitle : ${script.episodeTitle}`);
  console.log(`targetKeep   : ${(script.targetKeepSeconds / 60).toFixed(1)}分`);
  console.log(`segments     : ${script.segments.length}`);
  console.log(
    `must         : ${stats.mustCount}本 / ${(stats.mustSeconds / 60).toFixed(1)}分`,
  );
  console.log(
    `optional     : ${stats.optionalCount}本 / ${(stats.optionalSeconds / 60).toFixed(1)}分`,
  );
  console.log(
    `total        : ${(stats.totalSeconds / 60).toFixed(1)}分 (完成尺の${(
      stats.totalSeconds / script.targetKeepSeconds
    ).toFixed(2)}倍)`,
  );
  console.log(`hook         : ${(stats.hookSeconds).toFixed(0)}秒`);
  console.log(`speakerKeys  : ${[...new Set(script.segments.map((s) => s.speakerKey))].join(", ")}`);
  console.log("---");

  // 検証
  const validSpeakerKeys = new Set(styleGuide.characters.map((c) => c.key));
  const assertions: Array<[string, boolean]> = [
    ["セグメントが3本以上", script.segments.length >= 3],
    ["話者キーが全てスタイルガイド内", script.segments.every((s) => validSpeakerKeys.has(s.speakerKey))],
    ["冒頭フックが存在", stats.hookSeconds > 0],
    ["フックは全て must", script.segments.filter((s) => s.isHook).every((s) => s.priority === "must")],
    ["optional に cutReason がある", script.segments.filter((s) => s.priority === "optional").every((s) => s.cutReason !== null)],
    ["must に cutReason がない", script.segments.filter((s) => s.priority === "must").every((s) => s.cutReason === null)],
    ["切る候補(optional)が1本以上", stats.optionalCount > 0],
    ["order が連番", script.segments.every((s, i) => s.order === i + 1)],
  ];

  let allPass = true;
  for (const [label, ok] of assertions) {
    console.log(`${ok ? "PASS" : "FAIL"} : ${label}`);
    if (!ok) allPass = false;
  }
  if (warnings.length > 0) {
    console.log("バランス警告:");
    for (const w of warnings) console.log(`  - ${w}`);
  } else {
    console.log("バランス警告: なし");
  }

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
