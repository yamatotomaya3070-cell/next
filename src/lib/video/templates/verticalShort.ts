// テンプレート: vertical_short（縦型ショート動画）
// character_explainer と同じ2キャラクター掛け合いエンジンを再利用し、
// 短尺・縦画面向けにナレーション長と目標尺のみを変える。
import type { TemplateScriptBase } from "./types";
import {
  validateCharacterExplainerScript,
  buildCharacterExplainerPrompt,
  type CharacterScene,
  type ValidationResult,
} from "./characterExplainer";

export interface VerticalShortScript extends TemplateScriptBase {
  templateType: "vertical_short";
  scenes: CharacterScene[];
}

const MAX_NARRATION_LENGTH = 60; // 縦型は短いテンポが前提

export function validateVerticalShortScript(
  raw: unknown,
  durationRange: { min: number; max: number; default: number },
): ValidationResult<VerticalShortScript> {
  const base = validateCharacterExplainerScript(raw, durationRange);
  if (!base.ok || !base.script) return { ok: false, errors: base.errors };

  const tooLong = base.script.scenes.filter((s) => s.narration.length > MAX_NARRATION_LENGTH);
  if (tooLong.length > 0) {
    return {
      ok: false,
      errors: [`縦型ショートはセリフを${MAX_NARRATION_LENGTH}文字以内にしてください（${tooLong.length}件超過）`],
    };
  }

  return {
    ok: true,
    errors: [],
    script: { ...base.script, templateType: "vertical_short" },
  };
}

export function buildVerticalShortPrompt(theme: string, targetDurationSec: number, repairNote?: string): string {
  const base = buildCharacterExplainerPrompt(theme, targetDurationSec, repairNote);
  return `${base}

追加条件（縦型ショート専用・厳守）:
- 1セリフは${MAX_NARRATION_LENGTH}文字以内。短くテンポよく
- 説明を詰め込みすぎない。1つの話題に絞る
- スマホで見る前提で、最初の1〜2シーンで惹きつける`;
}

export function mockVerticalShortScript(theme: string, targetDurationSec: number): VerticalShortScript {
  const raw = {
    title: `${theme}を30秒で`,
    description: `${theme}を縦型ショートでテンポよく紹介`,
    targetDurationSec,
    scenes: [
      { speakerId: "speaker_a", narration: `${theme}、知ってる？`, visualPrompt: "タイトル", characterExpression: "happy", editingInstructions: ["冒頭で惹きつける"] },
      { speakerId: "speaker_b", narration: "え、知らない。教えて！", visualPrompt: "はじまり", characterExpression: "surprised", editingInstructions: ["テンポよくカットする"] },
      { speakerId: "speaker_a", narration: "実はこれ、意外と身近なんだよ。", visualPrompt: "ポイント", characterExpression: "normal", editingInstructions: ["間を詰める"] },
      { speakerId: "speaker_b", narration: "ええっ、そうなんだ！", visualPrompt: "ポイント", characterExpression: "surprised", editingInstructions: [] },
      { speakerId: "speaker_a", narration: "気になったら、ぜひ調べてみてね。", visualPrompt: "まとめ", characterExpression: "happy", editingInstructions: ["最後に一瞬止める"] },
      { speakerId: "speaker_b", narration: "また次の動画でね！", visualPrompt: "おわり", characterExpression: "happy", editingInstructions: [] },
    ],
  };
  const result = validateVerticalShortScript(raw, { min: 15, max: 60, default: 30 });
  if (!result.ok || !result.script) throw new Error(`モック台本が検証に失敗: ${result.errors.join(", ")}`);
  return result.script;
}
