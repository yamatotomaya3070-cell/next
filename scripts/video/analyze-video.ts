/**
 * 【R2 ゲート検証スパイク】Geminiが動画を読み取れるかの実証。
 * 動画をinline_data(base64)でGeminiに送り、編集特徴を構造化抽出する。
 * これが通れば「実案件動画から学習して生成レベルを上げる」(docs/00011 §5 Loop A)が実装可能。
 *
 * 実行: npx tsx scripts/video/analyze-video.ts <動画パス>
 * モデル: 既定 gemini-2.0-flash（動画非対応なら GEMINI_VIDEO_MODEL で上書き）
 */
import { readFileSync } from "node:fs";
import { loadEnvLocal } from "./env";

loadEnvLocal();

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const PROMPT = `あなたは動画編集ディレクターです。この動画を見て、編集の特徴を構造化してください。
目的: 生成AIが「同じジャンル・同じ水準の練習案件」を作るための学習データにすること。
必ず有効なJSONのみを出力する。

JSONスキーマ:
{
  "genre": "推定ジャンル",
  "summary": "内容の要約(2-3文)",
  "estimatedCutsPerMinute": number,
  "pacing": "速い|普通|ゆっくり",
  "telop": { "density": "多い|普通|少ない", "style": "色・位置・装飾の特徴", "hasMotion": boolean },
  "bRoll": "Bロール/インサート映像の使い方",
  "structure": ["冒頭フック", "本編", "まとめ" のような構成要素の配列],
  "bgmSe": "BGM・効果音の使い方の印象",
  "colorTone": "色調・明るさの印象",
  "professionalPoints": ["プロっぽさを生んでいる要素"],
  "gapsForTrainingGeneration": ["この水準に練習生成を近づけるために生成側で必要な要素"]
}`;

async function main(): Promise<void> {
  const videoPath = process.argv[2];
  if (!videoPath) throw new Error("動画パスを指定してください");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");
  const model = process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const base64 = readFileSync(videoPath).toString("base64");
  console.log(`model: ${model} / video: ${videoPath} / base64長: ${Math.round(base64.length / 1024)}KB`);

  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: "video/mp4", data: base64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini動画解析エラー (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("空の応答（動画非対応の可能性。GEMINI_VIDEO_MODELで動画対応モデルを指定）");

  console.log("\n===== Geminiが抽出した編集特徴 =====");
  console.log(JSON.stringify(JSON.parse(text), null, 2));
  const usage = data?.usageMetadata;
  if (usage) console.log(`\nトークン: prompt=${usage.promptTokenCount} / total=${usage.totalTokenCount}`);
  console.log("\n✅ Gemini動画理解が動作（docs/00011 §9-1 のゲート通過）");
}

main().catch((err) => {
  console.error("❌ 失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
