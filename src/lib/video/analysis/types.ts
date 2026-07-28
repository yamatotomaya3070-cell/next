/**
 * 動画理解サブシステムの共通型（docs/00011 の Loop A: 生成レベル向上）。
 *
 * 実案件/参考動画を Gemini 動画理解で読み取り、編集パターンを構造化する。
 * これを案件生成プロンプトに注入し、生成される仕様書・手順書・難易度を
 * 「実クラウドワークス案件と同じ編集水準」に近づける。
 *
 * AiProvider（gemini/mock 二重化）と同じ思想で VideoUnderstandingProvider を新設し、
 * gemini 失敗時は mock（既定パターン）へフォールバックする。
 */

/** 1本の動画から抽出した編集の特徴（テンプレート非依存の共通形） */
export interface EditingPattern {
  genre: string; // 推定ジャンル
  summary: string; // 内容の要約（職員向け）
  estimatedCutsPerMinute: number; // テンポの指標（1分あたりのカット数の体感）
  pacing: string; // "速い" | "普通" | "ゆっくり"
  telop: {
    density: string; // "多い" | "普通" | "少ない"
    style: string; // 色・位置・装飾の特徴
    hasMotion: boolean; // 動きのあるテロップか
  };
  bRoll: string; // Bロール/インサート映像の使い方
  structure: string[]; // 構成要素（冒頭フック・本編・まとめ 等）
  bgmSe: string; // BGM・効果音の使い方
  colorTone: string; // 色調・明るさの印象
  professionalPoints: string[]; // プロっぽさを生む要素
  gapsForTrainingGeneration: string[]; // この水準に生成を近づけるために必要な要素
}

export interface AnalyzeVideoInput {
  videoBase64: string; // 動画のbase64（呼び出し側でファイル読み込み・縮小して渡す）
  mimeType: string; // 例: "video/mp4"
  hint?: string; // 任意: ジャンルやテーマのヒント（案件側の情報）
}

export interface VideoUnderstandingProvider {
  readonly name: "gemini" | "mock";
  analyze(input: AnalyzeVideoInput): Promise<EditingPattern>;
}

/**
 * 編集パターンを案件生成プロンプトへ注入するためのテキストブロックに整形する。
 * generateTask / generateSimilarCase の editingPatternContext に渡す。
 */
export function editingPatternToPromptBlock(p: EditingPattern): string {
  return [
    "実案件（参考動画）から読み取った編集パターン。練習案件をこの水準・このテンポ・この編集量に寄せること:",
    `- ジャンル: ${p.genre}`,
    `- テンポ: ${p.pacing}（体感カット数 約${p.estimatedCutsPerMinute}回/分）`,
    `- テロップ: 量=${p.telop.density} / 特徴=${p.telop.style} / 動き=${p.telop.hasMotion ? "あり" : "なし"}`,
    `- Bロール・インサート: ${p.bRoll}`,
    `- 構成: ${p.structure.join(" → ")}`,
    `- BGM・効果音: ${p.bgmSe}`,
    `- プロっぽさの要因: ${p.professionalPoints.join(" / ")}`,
    `- 練習をこの水準に近づけるために必要な要素: ${p.gapsForTrainingGeneration.join(" / ")}`,
  ].join("\n");
}
