/**
 * VideoUnderstandingProvider の mock 実装。
 * GEMINI_API_KEY 未設定時・gemini失敗時のフォールバック。
 * 動画は読めないため、一般的な「実務水準の目安」を返す（生成が空注入で崩れないための下限）。
 */
import type { AnalyzeVideoInput, EditingPattern, VideoUnderstandingProvider } from "./types";

export const mockVideoUnderstanding: VideoUnderstandingProvider = {
  name: "mock",

  async analyze(input: AnalyzeVideoInput): Promise<EditingPattern> {
    return {
      genre: input.hint || "一般的な解説・紹介動画",
      summary: "（モック）動画は解析していません。実務水準の一般的な目安を返します。",
      estimatedCutsPerMinute: 12,
      pacing: "普通",
      telop: { density: "普通", style: "読みやすい色・位置。要点は強調する", hasMotion: false },
      bRoll: "解説内容に合った映像を要所に挿入する",
      structure: ["冒頭フック", "本編（要点ごと）", "まとめ"],
      bgmSe: "落ち着いたBGMを小音量で。効果音は要所のみ",
      colorTone: "明るく見やすい色調",
      professionalPoints: ["テンポの良いカット", "内容と同期したテロップ", "適切なBGM音量"],
      gapsForTrainingGeneration: [
        "テロップとナレーションの同期",
        "不要部分のカット判断",
        "BGM音量の調整",
      ],
    };
  },
};
