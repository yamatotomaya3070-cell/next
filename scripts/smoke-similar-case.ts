// 一時的な動作確認スクリプト: モックの実案件→類似模擬案件生成
import { mockProvider } from "../src/lib/ai/mock";

const SAMPLE_RAW_CASE = `
【急募】飲食店のPR動画編集をお願いします

はじめまして。株式会社グルメサンプルの採用担当です。
弊社が運営する「サンプル食堂 渋谷店」の紹介動画（撮影済み素材 約10分）を
1分30秒にまとめる編集をお願いします。

・不要な部分のカット
・店名と営業時間のテロップ挿入
・明るい雰囲気のBGMを追加
・納品形式: MP4 (1920x1080)
・報酬: 5,000円
・連絡先: sample@gourmet-sample.co.jp
・参考: https://example.com/sample-video
`;

async function main() {
  const result = await mockProvider.generateSimilarCase({
    rawCaseText: SAMPLE_RAW_CASE,
    traineeNote: "長時間の集中が苦手なため、作業を細かく区切る",
  });

  const checks: Array<[string, boolean]> = [
    ["title が【練習】で始まる", result.title.startsWith("【練習】")],
    ["requestDoc がある", result.requestDoc.length > 0],
    ["manualSteps が5件以上", result.manualSteps.length >= 5],
    ["revisionNote がある", result.revisionNote.length > 0],
    ["sampleDescription がある", result.sampleDescription.length > 0],
    ["skillTags にテロップ推定が含まれる", result.skillTags.includes("telop")],
    ["マスク済みテキストに会社名が残っていない", !result.maskedCaseText.includes("株式会社")],
    ["マスク済みテキストにメールが残っていない", !result.maskedCaseText.includes("@")],
    ["マスク済みテキストにURLが残っていない", !result.maskedCaseText.includes("https://")],
    ["マスク済みテキストに金額が残っていない", !/[0-9,]+円/.test(result.maskedCaseText)],
    ["maskingReport.removedItems が記録されている", result.maskingReport.removedItems.length >= 3],
  ];

  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
    if (!ok) failed += 1;
  }
  console.log("---");
  console.log("maskedCaseText:", result.maskedCaseText.trim().slice(0, 300));
  console.log("removedItems:", result.maskingReport.removedItems);
  if (failed > 0) {
    console.error(`${failed} 件のチェックに失敗`);
    process.exit(1);
  }
  console.log("すべてのチェックに合格");
}

main();
