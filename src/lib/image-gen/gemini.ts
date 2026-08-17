/**
 * Gemini 画像生成プロバイダ（Stage3）。既存 GEMINI_API_KEY を流用（クレカ不要）。
 *
 * generateContent + responseModalities:["IMAGE"] で画像を得る（TTSのAUDIO経路と同思想）。
 * 表情差分は base（normal）画像を inline_data で参照に渡す image-to-image で、
 * キャラの見た目を保ったまま表情だけ変える（いわゆる nano-banana のキャラ一貫性）。
 *
 * 注意: 公開APIに数値 seed パラメータが無いため、seed はプロンプト内の一貫性アンカー
 * として使い、実際の一貫性担保は「base画像を参照する」ことで行う。
 */

import type { StyleGuideExpression } from "@/lib/style-guide/schema";
import type {
  GenerateCharacterBaseInput,
  GenerateCharacterExpressionInput,
  GeneratedImage,
  ImageGenProvider,
} from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;

const EXPRESSION_JA: Record<StyleGuideExpression, string> = {
  normal: "ふつうの表情（真顔・落ち着いた顔）",
  happy: "うれしそうな笑顔",
  surprised: "おどろいた表情（目を見開く）",
  thinking: "考えているような表情",
};

function imageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function buildPrompt(
  input: GenerateCharacterBaseInput,
  expression: StyleGuideExpression,
  withReference: boolean,
): string {
  const consistency = withReference
    ? "参照画像とまったく同じキャラクター（体型・色・服・パーツ）を保ち、表情だけを変えてください。"
    : `このキャラクターは以降くり返し使う固定デザインです（一貫性ID: ${input.seed}）。`;
  return `1体のオリジナルキャラクターの立ち絵を1枚だけ生成してください。
画風: ${input.artStyle}
キャラの見た目: ${input.appearance}
表情: ${EXPRESSION_JA[expression]}
配色の参考: 主役色 ${input.palette.primary} / アクセント ${input.palette.accent}
構図: 全身または上半身、正面向き、単色に近い背景（切り抜きしやすいように）。
${consistency}
避けること: ${input.negativeStyle}。実在の人物・既存アニメ・既存キャラクターの模倣は禁止。文字やロゴは入れない。`;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

async function callImageOnce(
  input: GenerateCharacterBaseInput,
  expression: StyleGuideExpression,
  baseImage?: GeneratedImage,
): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");

  const parts: GeminiPart[] = [{ text: buildPrompt(input, expression, Boolean(baseImage)) }];
  if (baseImage) {
    parts.push({
      inline_data: { mime_type: baseImage.mimeType, data: bytesToBase64(baseImage.bytes) },
    });
  }

  const res = await fetch(`${API_BASE}/${imageModel()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Gemini 画像API エラー (${res.status}): ${body.slice(0, 300)}`);
    (err as Error & { retryable?: boolean }).retryable = res.status === 429 || res.status >= 500;
    throw err;
  }

  const data = await res.json();
  const respParts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = respParts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const inline = imgPart?.inlineData ?? imgPart?.inline_data;
  const b64 = (inline as { data?: string } | undefined)?.data;
  const mimeType =
    (imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type) ?? "image/png";
  if (!b64) throw new Error("Gemini 画像応答に画像データが含まれていません");
  return { bytes: new Uint8Array(Buffer.from(b64, "base64")), mimeType };
}

async function callImage(
  input: GenerateCharacterBaseInput,
  expression: StyleGuideExpression,
  baseImage?: GeneratedImage,
): Promise<GeneratedImage> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callImageOnce(input, expression, baseImage);
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof Error &&
        ((err as Error & { retryable?: boolean }).retryable === true ||
          err.name === "TimeoutError" ||
          err.name === "AbortError");
      if (!retryable || attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw lastErr;
}

export const geminiImageProvider: ImageGenProvider = {
  name: "gemini",

  async generateCharacterBase(input: GenerateCharacterBaseInput): Promise<GeneratedImage> {
    return callImage(input, "normal");
  },

  async generateCharacterExpression(
    input: GenerateCharacterExpressionInput,
  ): Promise<GeneratedImage> {
    return callImage(input, input.expression, input.baseImage);
  },
};
