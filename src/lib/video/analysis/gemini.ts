/**
 * Gemini 動画理解による編集パターン抽出（VideoUnderstandingProvider の gemini 実装・inline版）。
 * 動画を inline_data(base64) で generateContent に送る（20MB未満想定。呼び出し側で縮小）。
 * 大容量/長尺は Files API 版（geminiFiles.ts）を使う。
 * 動画対応モデルが必要: 既定 gemini-2.5-flash（GEMINI_VIDEO_MODEL で上書き可）。
 */
import type {
  AnalyzeVideoInput,
  EditingPattern,
  VideoUnderstandingProvider,
} from "./types";
import { buildAnalysisPrompt, coercePattern, extractGeneratedText } from "./geminiShared";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_VIDEO_MODEL = "gemini-2.5-flash";

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
              { text: buildAnalysisPrompt(input.hint) },
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
    const text = extractGeneratedText(data);
    if (!text) throw new Error("Gemini動画理解が空応答（モデルの動画対応を要確認）");
    return coercePattern(JSON.parse(text) as Partial<EditingPattern>);
  },
};
