// 動画テンプレート（案件ジャンル）の共通の型。
// 「共通処理」はここと pipeline.ts / exec.ts / tts.ts の汎用部分が担い、
// 「テンプレート固有処理」は templates/<name>/ 配下に閉じ込める。
// 新しいジャンルを追加するときは templates/<newType>/ を1つ増やし、
// registry.ts に登録するだけで済む設計にする。

export const VIDEO_TEMPLATE_TYPES = [
  "character_explainer",
  "vertical_short",
  "business_explainer",
  "product_promotion",
  "interview_edit",
  "vlog_edit",
] as const;
export type VideoTemplateType = (typeof VIDEO_TEMPLATE_TYPES)[number];

/** 最初のリリースで実際に生成できるテンプレート。他は管理画面に表示のみ（準備中） */
export const IMPLEMENTED_TEMPLATE_TYPES: VideoTemplateType[] = [
  "character_explainer",
  "vertical_short",
  "business_explainer",
  "interview_edit",
];

export type AspectRatio = "16:9" | "9:16";

/** 台本生成前に確定させる、テンプレートごとの案件メタデータ（管理画面のジャンル選択に使う） */
export interface VideoTemplateConfig {
  type: VideoTemplateType;
  label: string;
  description: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  durationRange: { min: number; max: number; default: number };
  /** 支給素材として就労者に渡す素材の種類（表示用の説明文） */
  requiredAssetKinds: string[];
  subtitleStyle: {
    maxCharsPerLine: number;
    maxLines: number;
    fontSize: number;
    /** 画面下端からの安全マージン（px、当該解像度基準） */
    marginBottom: number;
  };
  /** 就労者がこのテンプレートで行う編集作業 */
  traineeTasks: string[];
  /** AIが事前に生成しておく作業（就労者の作業範囲に含まれないもの） */
  aiPregenTasks: string[];
  /** このジャンルで練習できる編集スキル（既存の SKILL_TAG_LABELS のキー） */
  skillTags: string[];
  defaultDifficulty: number;
  /** 採点項目（職員確認・AI採点の観点） */
  gradingCriteria: string[];
  toleranceSec: number;
}

/** すべてのテンプレート台本に共通するトップレベル項目 */
export interface TemplateScriptBase {
  templateType: VideoTemplateType;
  title: string;
  description: string;
  targetDurationSec: number;
}

/** すべてのテンプレートのシーン/セグメントに共通する項目 */
export interface TemplateSceneBase {
  id: string;
  order: number;
  narration: string; // 読み上げ文（空文字=無音セグメント。ふりがな記法禁止）
  editingInstructions: string[];
}

/** 音声実測後のタイミング（テンプレート非依存の共通形） */
export interface TemplateSceneTiming {
  sceneId: string;
  order: number;
  narration: string;
  startSec: number;
  endSec: number;
  audioFile: string;
  subtitleLines: string[];
  speakerLabel: string; // 表示用の話者名（色分け・字幕生成に使用）
  subtitleColor: string;
}

export interface TemplateTimeline {
  totalDurationSec: number;
  scenes: TemplateSceneTiming[];
}

/** 正解データ（テンプレート非依存の共通形。職員のみ閲覧） */
export interface TemplateAnswerData {
  title: string;
  templateType: VideoTemplateType;
  totalDurationSec: number;
  toleranceSec: number;
  volumeTargetDb: { min: number; max: number };
  requiredEdits: string[];
  sceneOrder: string[];
  subtitles: Array<{ sceneId: string; text: string; startSec: number; endSec: number; speakerLabel: string }>;
  assets: string[];
}
