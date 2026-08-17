/**
 * 画像生成のモックプロバイダ（Stage3）。
 * GEMINI_API_KEY 未設定・Gemini 失敗時のフォールバック。
 * パレット＋seed＋表情から決定的なプレースホルダ立ち絵（SVG→PNG）を作る。
 * 実キャラの見た目にはならないが、パイプライン全体を0円・オフラインで通せる。
 *
 * sharp はネイティブ依存のため、クライアント/エッジに巻き込まないよう
 * 関数内で動的 import する（このモジュールは server action / script からのみ使う）。
 */

import type { StyleGuideExpression } from "@/lib/style-guide/schema";
import type {
  GenerateCharacterBaseInput,
  GenerateCharacterExpressionInput,
  GeneratedImage,
  ImageGenProvider,
} from "./types";

const CHAR_W = 480;
const CHAR_H = 640;

function eyes(expression: StyleGuideExpression): string {
  if (expression === "surprised") {
    return `<circle cx="185" cy="255" r="30" fill="#fff"/><circle cx="295" cy="255" r="30" fill="#fff"/>
      <circle cx="185" cy="258" r="13" fill="#222"/><circle cx="295" cy="258" r="13" fill="#222"/>`;
  }
  if (expression === "happy") {
    return `<path d="M155 255 Q185 230 215 255" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M265 255 Q295 230 325 255" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  }
  if (expression === "thinking") {
    return `<circle cx="185" cy="252" r="26" fill="#fff"/><circle cx="295" cy="252" r="26" fill="#fff"/>
      <circle cx="178" cy="248" r="11" fill="#222"/><circle cx="288" cy="248" r="11" fill="#222"/>`;
  }
  return `<circle cx="185" cy="250" r="28" fill="#fff"/><circle cx="295" cy="250" r="28" fill="#fff"/>
    <circle cx="192" cy="254" r="12" fill="#222"/><circle cx="302" cy="254" r="12" fill="#222"/>`;
}

function mouth(expression: StyleGuideExpression): string {
  if (expression === "surprised") return `<ellipse cx="240" cy="322" rx="20" ry="28" fill="#663333"/>`;
  if (expression === "happy")
    return `<path d="M200 312 Q240 350 280 312 Z" fill="#663333"/>`;
  if (expression === "thinking")
    return `<path d="M210 322 L270 322" stroke="#222" stroke-width="8" stroke-linecap="round"/>`;
  return `<path d="M215 315 Q240 332 265 315" stroke="#222" stroke-width="8" fill="none" stroke-linecap="round"/>`;
}

/** seed で体型（丸/角丸）を決定的に振り分ける */
function placeholderSvg(
  palette: { background: string; primary: string; accent: string },
  seed: number,
  expression: StyleGuideExpression,
): string {
  const rounded = seed % 2 === 0;
  const body = rounded
    ? `<circle cx="240" cy="255" r="160" fill="${palette.primary}" stroke="#222" stroke-width="8"/>
       <circle cx="240" cy="268" r="122" fill="#ffffff" opacity="0.9"/>`
    : `<rect x="95" y="110" width="290" height="290" rx="90" fill="${palette.primary}" stroke="#222" stroke-width="8"/>
       <rect x="120" y="150" width="240" height="210" rx="70" fill="#ffffff" opacity="0.9"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHAR_W}" height="${CHAR_H}" viewBox="0 0 480 640">
    <rect width="480" height="640" fill="${palette.background}"/>
    ${body}
    ${eyes(expression)}
    ${mouth(expression)}
    <circle cx="145" cy="300" r="16" fill="${palette.accent}" opacity="0.8"/>
    <circle cx="335" cy="300" r="16" fill="${palette.accent}" opacity="0.8"/>
    <ellipse cx="240" cy="480" rx="120" ry="90" fill="${palette.primary}" stroke="#222" stroke-width="8"/>
  </svg>`;
}

async function renderPng(svg: string): Promise<GeneratedImage> {
  const sharpMod = await import("sharp");
  const sharp = sharpMod.default;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { bytes: new Uint8Array(buffer), mimeType: "image/png" };
}

export const mockImageProvider: ImageGenProvider = {
  name: "mock",

  async generateCharacterBase(input: GenerateCharacterBaseInput): Promise<GeneratedImage> {
    return renderPng(placeholderSvg(input.palette, input.seed, "normal"));
  },

  async generateCharacterExpression(
    input: GenerateCharacterExpressionInput,
  ): Promise<GeneratedImage> {
    return renderPng(placeholderSvg(input.palette, input.seed, input.expression));
  },
};
