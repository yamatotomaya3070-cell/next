/**
 * Gemini 動画理解による編集パターン抽出（VideoUnderstandingProvider の gemini 実装）。
 * 動画を inline_data(base64) で generateContent に送る（20MB未満想定。呼び出し側で縮小）。
 * 動画対応モデルが必要: 既定 gemini-2.5-flash（GEMINI_VIDEO_MODEL で上書き可）。
 */
import type {
  AnalyzeVideoInput,
  EditingPattern,
  VideoUnderstandingProvider,
} from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_VIDEO_MODEL = "gemini-2.5-flash";

function buildPrompt(hint?: string): string {
  return `あなたは動画編集ディレクターです。この動画を見て、編集の特徴を構造化してください。
目的: 生成AIが「同じジャンル・同じ水準の練習案件」を作るための学習データにすること。
${hint ? `参考情報（案件のテーマ/ジャンル）: ${hint}\n` : ""}必ず有効なJSONのみを出力する。

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
}

function coerce(parsed: Partial<EditingPattern>): EditingPattern {
  const telop = parsed.telop ?? { density: "普通", style: "", hasMotion: false };
  return {
    genre: parsed.genre ?? "不明",
    summary: parsed.summary ?? "",
    estimatedCutsPerMinute: Number(parsed.estimatedCutsPerMinute ?? 0) || 0,
    pacing: parsed.pacing ?? "普通",
    telop: {
      density: telop.density ?? "普通",
      style: telop.style ?? "",
      hasMotion: Boolean(telop.hasMotion),
    },
    bRoll: parsed.bRoll ?? "",
    structure: Array.isArray(parsed.structure) ? parsed.structure : [],
    bgmSe: parsed.bgmSe ?? "",
    colorTone: parsed.colorTone ?? "",
    professionalPoints: Array.isArray(parsed.professionalPoints) ? parsed.professionalPoints : [],
    gapsForTrainingGeneration: Array.isArray(parsed.gapsForTrainingGeneration)
      ? parsed.gapsForTrainingGeneration
      : [],
  };
}

export const geminiVideoUnderstanding: VideoUnderstandingProvider = {
  name: "gemini",

  async analyze(input: AnalyzeVideoInput): Promise<EditingPattern> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です（動画理解）");
    const model = process.env.GEMINI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL;

    const res = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: input.mimeType, data: input.videoBase64 } },
              { text: buildPrompt(input.hint) },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini動画理解エラー (${res.status}): ${(await res.text()).slice(0, 400)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini動画理解が空応答（モデルの動画対応を要確認）");
    return coerce(JSON.parse(text) as Partial<EditingPattern>);
  },
};
