/**
 * Gemini 動画理解の共通部品（inline版 gemini.ts と Files API版 geminiFiles.ts で共有）。
 * プロンプト・レスポンス整形・EditingPattern への coerce を一箇所に集約する（DRY）。
 */
import type { EditingPattern } from "./types";

/** 動画理解プロンプト（有効なJSONのみを返させる） */
export function buildAnalysisPrompt(hint?: string): string {
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

/** generateContent のレスポンスから最初のテキストパートを取り出す */
export function extractGeneratedText(data: unknown): string {
  const candidates = (data as { candidates?: unknown[] } | null)?.candidates;
  const first = Array.isArray(candidates) ? candidates[0] : undefined;
  const parts = (first as { content?: { parts?: unknown[] } } | undefined)?.content?.parts;
  const textPart = Array.isArray(parts) ? parts.find((p) => typeof (p as { text?: unknown }).text === "string") : undefined;
  return (textPart as { text?: string } | undefined)?.text ?? "";
}

/** 欠損フィールドを既定値で埋め、型を保証する */
export function coercePattern(parsed: Partial<EditingPattern>): EditingPattern {
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
