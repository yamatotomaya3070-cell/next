/**
 * キャラクター立ち絵などの画像生成プロバイダ抽象（Stage3）。
 *
 * AiProvider / VideoUnderstandingProvider と同じ思想:
 *  - 既定は Gemini 画像生成（既存 GEMINI_API_KEY を流用＝クレカ不要）。
 *  - 失敗・キー未設定時は mock（決定的なプレースホルダ画像）にフォールバック。
 *
 * キャラの一貫性（同一キャラで表情だけ差し替え）は
 *  - base（normal 表情）を seed 付きで1枚生成し、
 *  - 表情差分は base 画像を参照画像として渡す image-to-image で作る、
 * という2段構えで担保する。
 */

import type { StyleGuideExpression } from "@/lib/style-guide/schema";

/** 生成された画像（バイト列とMIME） */
export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: string; // "image/png" など
}

/** base（基準表情）画像の生成リクエスト */
export interface GenerateCharacterBaseInput {
  characterKey: string;
  appearance: string; // スタイルガイドの character.appearance（独自デザイン記述）
  artStyle: string; // スタイルガイドの artStyle（画風の基調）
  negativeStyle: string; // 避ける要素（崩れ・模倣回避）
  /** パレット（背景を透過にできない場合の下地・アクセント参考） */
  palette: { background: string; primary: string; accent: string };
  seed: number; // 再現性の基準（同一キャラで固定）
}

/** 表情差分画像の生成リクエスト（base 画像を参照して一貫性を保つ） */
export interface GenerateCharacterExpressionInput extends GenerateCharacterBaseInput {
  expression: StyleGuideExpression;
  /** base（normal）画像。image-to-image の参照に使う。無ければ text-to-image */
  baseImage?: GeneratedImage;
}

export interface ImageGenProvider {
  name: "gemini" | "mock";
  /** 基準表情（normal）を1枚生成する */
  generateCharacterBase(input: GenerateCharacterBaseInput): Promise<GeneratedImage>;
  /** 表情差分を生成する（可能なら base を参照して一貫性を保つ） */
  generateCharacterExpression(input: GenerateCharacterExpressionInput): Promise<GeneratedImage>;
}
