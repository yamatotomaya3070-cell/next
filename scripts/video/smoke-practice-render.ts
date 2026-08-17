/**
 * 練習素材レンダリング（Stage4配線）の実機スモーク。
 * ffmpeg + TTS を実際に使って、小さな練習台本から素材クリップ・完成見本・ZIPを書き出す。
 * 立ち絵は既存 assets/video の ao/midori を流用する（Stage3の実アセットが無くても通せる）。
 *
 * 実行: npx tsx scripts/video/smoke-practice-render.ts
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./env";
import { renderPracticeMaterials } from "./practice-render";
import { probeStreams } from "./exec";
import { normalizeStyleGuide } from "../../src/lib/style-guide/schema";
import { normalizePracticeScript } from "../../src/lib/practice-script/schema";

loadEnvLocal();

async function main() {
  const styleGuide = normalizeStyleGuide({
    name: "スモーク",
    client: { channelName: "つなぐ雑学ラボ", clientName: "たけし" },
    characters: [
      { key: "ao", name: "アオ", subtitleColor: "#1677E8", seed: 1000 },
      { key: "midori", name: "ミドリ", subtitleColor: "#2E9E5B", seed: 2000 },
    ],
  });

  // 短い台本（速く回すため）: must2 + optional1
  const script = normalizePracticeScript(
    {
      title: "つなぐ雑学ラボ 次回の編集",
      episodeTitle: "在宅ワークの始め方",
      clientMessage: "次回もよろしくお願いします。\nたけし",
      segments: [
        { id: "h", text: "きょうのテーマは在宅ワークです。", speakerKey: "ao", priority: "must", estimatedSeconds: 6, isHook: true },
        { id: "m", text: "まずは準備から説明します。", speakerKey: "midori", priority: "must", estimatedSeconds: 6 },
        { id: "o", text: "えーっと、これは関係ない雑談です。", speakerKey: "ao", priority: "optional", cutReason: "tangent", estimatedSeconds: 6 },
      ],
    },
    styleGuide,
    60,
  );

  const workdir = join("scripts", "output", "smoke-practice-render");
  console.log("レンダリング開始（TTS+ffmpeg。SAPI/Geminiにより数秒〜数十秒かかります）…");
  const result = await renderPracticeMaterials({
    workdir,
    script,
    styleGuide,
    difficulty: "intermediate",
    standingImages: {
      ao: join("assets", "video", "ao_normal.png"),
      midori: join("assets", "video", "midori_normal.png"),
    },
  });

  const checks: Array<[string, boolean]> = [];
  checks.push(["素材クリップ3本", result.clipFiles.length === 3]);
  for (const f of result.clipFiles) {
    let ok = false;
    try {
      const probe = probeStreams(join("clips", f), workdir);
      ok = probe.hasVideo && probe.hasAudio && probe.width === 1920 && probe.height === 1080;
    } catch {
      ok = false;
    }
    checks.push([`クリップ ${f} が1920x1080で映像+音声を持つ`, ok]);
  }
  const sampleProbe = probeStreams("render/sample.mp4", workdir);
  checks.push(["完成見本が映像+音声を持つ", sampleProbe.hasVideo && sampleProbe.hasAudio]);
  checks.push(["assets.zip が存在", existsSync(result.zipPath) && statSync(result.zipPath).size > 0]);

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} : ${label}`);
    if (!ok) allPass = false;
  }
  console.log(`完成見本尺: ${sampleProbe.durationSec.toFixed(1)}秒 / ZIP: ${result.zipPath}`);
  console.log(`正解データ: 残す${result.answerData.mustSegmentIds.length}本 / 切る${result.answerData.optionalSegmentIds.length}本`);

  if (!allPass) {
    console.error("スモーク失敗");
    process.exit(1);
  }
  console.log("スモーク成功（素材mp4を実際に書き出せました）");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
