// テンプレート・ディスパッチ層。
// 「共通処理」（script-gen/tts/subtitles/render/packageの各stage）はここが
// 公開する共通インターフェースだけを見ればよく、テンプレート固有の台本形状を
// 意識しない。新しいテンプレートを追加するときは、この switch に1ケース足すだけでよい。
import type { VideoTemplateType, TemplateSceneTiming } from "./types";
import { getTemplateConfig } from "./registry";
import {
  validateCharacterExplainerScript,
  buildCharacterExplainerPrompt,
  mockCharacterExplainerScript,
  CHARACTER_VOICES,
  type CharacterExplainerScript,
  type CharacterScene,
} from "./characterExplainer";
import {
  validateVerticalShortScript,
  buildVerticalShortPrompt,
  mockVerticalShortScript,
  type VerticalShortScript,
} from "./verticalShort";
import {
  validateBusinessExplainerScript,
  buildBusinessExplainerPrompt,
  mockBusinessExplainerScript,
  NARRATOR_VOICE,
  type BusinessExplainerScript,
  type SlideScene,
} from "./businessExplainer";
import {
  validateInterviewEditScript,
  buildInterviewEditPrompt,
  mockInterviewEditScript,
  INTERVIEW_VOICES,
  type InterviewEditScript,
  type InterviewSegment,
} from "./interviewEdit";

export { VIDEO_TEMPLATE_TYPES } from "./types";
export type { VideoTemplateType } from "./types";
export { TEMPLATE_REGISTRY, getTemplateConfig, isTemplateImplemented } from "./registry";
export type { VideoTemplateConfig } from "./types";
export type { CharacterExplainerScript, CharacterScene } from "./characterExplainer";
export type { VerticalShortScript } from "./verticalShort";
export type { BusinessExplainerScript, SlideScene } from "./businessExplainer";
export type { InterviewEditScript, InterviewSegment, CutReason } from "./interviewEdit";

export type AnyVideoScript =
  | CharacterExplainerScript
  | VerticalShortScript
  | BusinessExplainerScript
  | InterviewEditScript;

export interface VoiceProfile {
  id: string;
  label: string;
  subtitleColor: string;
  pitchFactor: number;
  rate: number;
}

export interface TemplateValidationResult {
  ok: boolean;
  errors: string[];
  script?: AnyVideoScript;
}

/** テンプレートで使用する話者（音声）一覧。TTSのピッチ/話速差別化に使用 */
export function getVoiceProfiles(type: VideoTemplateType): VoiceProfile[] {
  switch (type) {
    case "character_explainer":
    case "vertical_short":
      return CHARACTER_VOICES.map((v) => ({ id: v.id, label: v.name, subtitleColor: v.subtitleColor, pitchFactor: v.pitchFactor, rate: v.rate }));
    case "business_explainer":
      return [{ id: NARRATOR_VOICE.id, label: NARRATOR_VOICE.name, subtitleColor: NARRATOR_VOICE.subtitleColor, pitchFactor: NARRATOR_VOICE.pitchFactor, rate: NARRATOR_VOICE.rate }];
    case "interview_edit":
      return INTERVIEW_VOICES.map((v) => ({ id: v.id, label: v.name, subtitleColor: v.subtitleColor, pitchFactor: v.pitchFactor, rate: v.rate }));
    default:
      throw new Error(`テンプレート ${type} は未実装です`);
  }
}

export function validateTemplateScript(type: VideoTemplateType, raw: unknown): TemplateValidationResult {
  const durationRange = getTemplateConfig(type).durationRange;
  switch (type) {
    case "character_explainer":
      return validateCharacterExplainerScript(raw, durationRange);
    case "vertical_short":
      return validateVerticalShortScript(raw, durationRange);
    case "business_explainer":
      return validateBusinessExplainerScript(raw, durationRange);
    case "interview_edit":
      return validateInterviewEditScript(raw, durationRange);
    default:
      return { ok: false, errors: [`テンプレート ${type} は未実装です`] };
  }
}

export function buildScriptPrompt(type: VideoTemplateType, theme: string, targetDurationSec: number, repairNote?: string): string {
  switch (type) {
    case "character_explainer":
      return buildCharacterExplainerPrompt(theme, targetDurationSec, repairNote);
    case "vertical_short":
      return buildVerticalShortPrompt(theme, targetDurationSec, repairNote);
    case "business_explainer":
      return buildBusinessExplainerPrompt(theme, targetDurationSec, repairNote);
    case "interview_edit":
      return buildInterviewEditPrompt(theme, targetDurationSec, repairNote);
    default:
      throw new Error(`テンプレート ${type} は未実装です`);
  }
}

export function mockTemplateScript(type: VideoTemplateType, theme: string, targetDurationSec: number): AnyVideoScript {
  switch (type) {
    case "character_explainer":
      return mockCharacterExplainerScript(theme, targetDurationSec);
    case "vertical_short":
      return mockVerticalShortScript(theme, targetDurationSec);
    case "business_explainer":
      return mockBusinessExplainerScript(theme, targetDurationSec);
    case "interview_edit":
      return mockInterviewEditScript(theme, targetDurationSec);
    default:
      throw new Error(`テンプレート ${type} は未実装です`);
  }
}

/** TTS入力用の共通シーン形。narration===""は無音セグメント（interview_editのsilenceのみ） */
export interface AudioScene {
  id: string;
  order: number;
  narration: string;
  voiceId: string;
  silenceSeconds: number | null;
}

export function toAudioScenes(script: AnyVideoScript): AudioScene[] {
  switch (script.templateType) {
    case "character_explainer":
    case "vertical_short":
      return (script.scenes as CharacterScene[]).map((s) => ({
        id: s.id,
        order: s.order,
        narration: s.narration,
        voiceId: s.speakerId,
        silenceSeconds: null,
      }));
    case "business_explainer":
      return (script.scenes as SlideScene[]).map((s) => ({
        id: s.id,
        order: s.order,
        narration: s.narration,
        voiceId: NARRATOR_VOICE.id,
        silenceSeconds: null,
      }));
    case "interview_edit":
      return (script.scenes as InterviewSegment[]).map((s) => ({
        id: s.id,
        order: s.order,
        narration: s.narration,
        voiceId: s.speakerId,
        silenceSeconds: s.silenceSeconds,
      }));
    default:
      throw new Error("未対応のテンプレートです");
  }
}

/** interview_edit専用: 完成見本(サンプル)に含めるシーンだけを抽出（kind=keepのみ） */
export function keepOnlyScenes(script: AnyVideoScript): AnyVideoScript {
  if (script.templateType !== "interview_edit") return script;
  return { ...script, scenes: script.scenes.filter((s) => s.kind === "keep") };
}

/** レンダリング用の共通シーン形（描画・字幕・立ち絵表示の指示） */
export interface RenderSceneInfo {
  id: string;
  order: number;
  cardTitle: string | null;
  cardText: string | null;
  characterKey: "ao" | "midori" | null;
  characterExpression: string | null;
  characterPosition: "left" | "right" | null;
  speakerLabel: string | null;
}

export function toRenderScenes(script: AnyVideoScript): RenderSceneInfo[] {
  switch (script.templateType) {
    case "character_explainer":
    case "vertical_short":
      return (script.scenes as CharacterScene[]).map((s) => ({
        id: s.id,
        order: s.order,
        // 冒頭シーンだけタイトルを表示し、以降はvisualPromptのカードを表示する
        cardTitle: s.order === 1 ? script.title : null,
        cardText: s.order === 1 ? null : s.visualPrompt || null,
        characterKey: s.speakerId === "speaker_a" ? "ao" : "midori",
        characterExpression: s.characterExpression,
        characterPosition: s.speakerId === "speaker_a" ? "left" : "right",
        speakerLabel: null,
      }));
    case "business_explainer":
      return (script.scenes as SlideScene[]).map((s) => ({
        id: s.id,
        order: s.order,
        cardTitle: s.slideTitle,
        cardText: s.bulletPoints.length > 0 ? s.bulletPoints.map((b) => `・${b}`).join("\n") : null,
        characterKey: null,
        characterExpression: null,
        characterPosition: null,
        speakerLabel: null,
      }));
    case "interview_edit":
      return (script.scenes as InterviewSegment[]).map((s) => ({
        id: s.id,
        order: s.order,
        cardTitle: null,
        cardText: null,
        characterKey: null,
        characterExpression: null,
        characterPosition: null,
        speakerLabel: getVoiceProfiles("interview_edit").find((v) => v.id === s.speakerId)?.label ?? s.speakerId,
      }));
    default:
      throw new Error("未対応のテンプレートです");
  }
}

/** 正解データ用: 必須編集項目・採点観点はテンプレート設定(registry)から引く共通ロジック */
export function requiredEditsFor(type: VideoTemplateType): string[] {
  return getTemplateConfig(type).gradingCriteria;
}

export type { TemplateSceneTiming };
