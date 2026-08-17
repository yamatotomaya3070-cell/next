/**
 * キャラクター立ち絵アセット（Stage3）の型とヘルパ。
 * スタイルガイドのキャラ × 表情ごとに1枚を生成し、Storage に保存＋DBに行を持つ。
 * 生成のたびに作り直すのではなく「資産化」して以降の全動画で使い回す。
 */

import { STYLE_GUIDE_EXPRESSIONS, type StyleGuideExpression } from "@/lib/style-guide/schema";

/** 立ち絵を保存する Storage バケット（職員のみ・非公開） */
export const CHARACTER_ASSET_BUCKET = "character-assets";

/** character_assets の1行 */
export interface CharacterAssetRecord {
  id: string;
  style_guide_id: string;
  character_key: string;
  expression: StyleGuideExpression;
  seed: number;
  storage_path: string;
  mime_type: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

/** キャラ1体分の全表情アセット（UI表示・生成状況の判定に使う） */
export interface CharacterAssetGroup {
  characterKey: string;
  assets: CharacterAssetRecord[];
  /** 4表情すべて揃っているか */
  isComplete: boolean;
}

const EXPRESSION_LABELS: Record<StyleGuideExpression, string> = {
  normal: "ふつう",
  happy: "笑顔",
  surprised: "おどろき",
  thinking: "考え中",
};

export function expressionLabel(expression: StyleGuideExpression): string {
  return EXPRESSION_LABELS[expression] ?? expression;
}

/** 表情の拡張子は PNG 固定（生成は PNG に正規化する） */
export function characterAssetStoragePath(
  styleGuideId: string,
  characterKey: string,
  expression: StyleGuideExpression,
): string {
  return `${styleGuideId}/${characterKey}_${expression}.png`;
}

/** 与えられたアセット行をキャラ単位にまとめ、表情の欠けを判定する */
export function groupAssetsByCharacter(
  assets: CharacterAssetRecord[],
  characterKeys: string[],
): CharacterAssetGroup[] {
  return characterKeys.map((characterKey) => {
    const own = assets
      .filter((a) => a.character_key === characterKey)
      .sort(
        (a, b) =>
          STYLE_GUIDE_EXPRESSIONS.indexOf(a.expression) -
          STYLE_GUIDE_EXPRESSIONS.indexOf(b.expression),
      );
    const presentExpressions = new Set(own.map((a) => a.expression));
    const isComplete = STYLE_GUIDE_EXPRESSIONS.every((e) => presentExpressions.has(e));
    return { characterKey, assets: own, isComplete };
  });
}
