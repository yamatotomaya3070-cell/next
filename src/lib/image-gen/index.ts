/**
 * 画像生成の入口。既定は Gemini（GEMINI_API_KEY があるとき）、無ければ mock。
 * base は各キャラ1回だけ生成し、表情差分は base を参照して一貫性を保つ。
 * 高レベルの「1キャラ分の全表情を作る」ヘルパも提供する。
 */

import { geminiImageProvider } from "./gemini";
import { mockImageProvider } from "./mock";
import { STYLE_GUIDE_EXPRESSIONS, type StyleGuideExpression } from "@/lib/style-guide/schema";
import type {
  GenerateCharacterBaseInput,
  GeneratedImage,
  ImageGenProvider,
} from "./types";

export type * from "./types";

function activeImageProvider(): ImageGenProvider {
  return process.env.GEMINI_API_KEY ? geminiImageProvider : mockImageProvider;
}

/** 1キャラ分の1表情の画像（どの表情か・provider名付き） */
export interface CharacterExpressionImage {
  expression: StyleGuideExpression;
  image: GeneratedImage;
  provider: string;
}

/**
 * 1キャラ分の全表情画像を生成する。
 * normal を base として先に作り、他の表情は base を参照して一貫性を保つ。
 * Gemini が失敗したら（キー未設定含め）mock にフォールバックし、その表情以降を mock で埋める。
 */
export async function generateCharacterExpressionSet(
  input: GenerateCharacterBaseInput,
): Promise<CharacterExpressionImage[]> {
  const provider = activeImageProvider();
  const results: CharacterExpressionImage[] = [];

  // base（normal）
  let base: GeneratedImage;
  let baseProviderName: string = provider.name;
  try {
    base = await provider.generateCharacterBase(input);
  } catch (err) {
    if (provider.name !== "gemini") throw err;
    console.error("Gemini base画像生成に失敗。mockにフォールバック:", err);
    base = await mockImageProvider.generateCharacterBase(input);
    baseProviderName = "mock(fallback)";
  }
  results.push({ expression: "normal", image: base, provider: baseProviderName });

  for (const expression of STYLE_GUIDE_EXPRESSIONS) {
    if (expression === "normal") continue;
    try {
      const image =
        baseProviderName.startsWith("mock")
          ? await mockImageProvider.generateCharacterExpression({ ...input, expression })
          : await provider.generateCharacterExpression({ ...input, expression, baseImage: base });
      results.push({
        expression,
        image,
        provider: baseProviderName.startsWith("mock") ? "mock" : provider.name,
      });
    } catch (err) {
      if (provider.name !== "gemini") throw err;
      console.error(`Gemini 表情(${expression})生成に失敗。mockにフォールバック:`, err);
      const image = await mockImageProvider.generateCharacterExpression({ ...input, expression });
      results.push({ expression, image, provider: "mock(fallback)" });
    }
  }

  return results;
}
