// 一時的な動作確認スクリプト: 機械検品の照合・自動採点ロジック（DB/ffmpeg接続なし）
import { compareProbeToAnswer } from "../src/lib/video/inspection/compare";
import { computeAutoScore } from "../src/lib/video/inspection/score";
import { getTemplateConfig } from "../src/lib/video/templates";
import type { TemplateAnswerData } from "../src/lib/video/templates/types";
import type { ProbeResult } from "../src/lib/video/inspection/types";

const answerData: TemplateAnswerData = {
  title: "AIをやさしく解説",
  templateType: "character_explainer",
  totalDurationSec: 60,
  toleranceSec: 1,
  volumeTargetDb: { min: -26, max: -12 },
  requiredEdits: ["音声の配置順序", "字幕の色分けと同期", "BGM音量", "完成尺"],
  sceneOrder: ["scene_001", "scene_002"],
  subtitles: [],
  assets: [],
};
const templateConfig = getTemplateConfig(answerData.templateType);

function run(label: string, probe: ProbeResult, expectAllPass: boolean) {
  const checks = compareProbeToAnswer(probe, answerData, templateConfig);
  const score = computeAutoScore(checks);
  const allPass = checks.every((c) => c.status === "pass");
  const ok = allPass === expectAllPass;
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}（自動採点 ${score}点, 全項目pass=${allPass}）`);
  if (!ok) {
    for (const c of checks) console.log(`  - ${c.label}: ${c.status}（実測:${c.actual} / 期待:${c.expected}）`);
  }
  return ok;
}

function main() {
  const results = [
    run(
      "完成見本相当（尺・解像度・音声/映像・音量すべて期待どおり）",
      { durationSec: 60.3, width: 1920, height: 1080, hasVideo: true, hasAudio: true, meanVolumeDb: -18 },
      true,
    ),
    run(
      "尺が大幅に超過",
      { durationSec: 75, width: 1920, height: 1080, hasVideo: true, hasAudio: true, meanVolumeDb: -18 },
      false,
    ),
    run(
      "解像度が違う（720p書き出し）",
      { durationSec: 60, width: 1280, height: 720, hasVideo: true, hasAudio: true, meanVolumeDb: -18 },
      false,
    ),
    run(
      "無音（音声トラックなし）",
      { durationSec: 60, width: 1920, height: 1080, hasVideo: true, hasAudio: false, meanVolumeDb: null },
      false,
    ),
    run(
      "音量が小さすぎる",
      { durationSec: 60, width: 1920, height: 1080, hasVideo: true, hasAudio: true, meanVolumeDb: -40 },
      false,
    ),
  ];

  const failed = results.filter((ok) => !ok).length;
  console.log("---");
  if (failed > 0) {
    console.error(`${failed} 件のチェックに失敗`);
    process.exit(1);
  }
  console.log("すべてのチェックに合格");
}

main();
