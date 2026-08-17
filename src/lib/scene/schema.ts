/**
 * SCENE データモデル（再設計P0の中核＝全機能の共通言語）。
 *
 * 完成動画を「1シーン = 映像1レイヤー + 音声1〜複数発話 + 編集指示」に分解する。
 * 設計の正は docs/redesign/04（§3 映像12種 / §4 音声9演技 / §7 schema）。
 *
 * AI生成結果・DB/フォーム由来の改ざんされうる値は必ず normalizeVideoProject / normalizeScene を
 * 通してから使う（style-guide/schema.ts・practice-script/schema.ts と同じ手書き正規化の思想）。
 * zod は使わず、enum フォールバック＋欠損補完を明示的に書く。
 */

/** 7段構成のセクション（§5）。動画全体の骨格。 */
export const SECTIONS = [
  "hook", "problem", "basics", "example", "dialogue", "caution", "summary", "cta",
] as const;
export type Section = (typeof SECTIONS)[number];

/** 映像表現12種（§3）。金融の数字・比較・仕組みは図解が第一選択。 */
export const VISUAL_TYPES = [
  "comparison", "number_animation", "chart", "infographic",
  "character_conversation", "character_explanation", "text_emphasis",
  "timeline", "process", "recap", "generated_video", "broll",
] as const;
export type VisualType = (typeof VISUAL_TYPES)[number];

/** 話者。character master 参照（narrator=ナレ / mina=先生 / haru=初心者）。 */
export const SPEAKERS = ["narrator", "mina", "haru"] as const;
export type Speaker = (typeof SPEAKERS)[number];

/** 感情（§4辞書）。emotion→表情マップの入力にもなる。 */
export const EMOTIONS = [
  "neutral", "curious", "tension", "positive_surprise", "surprise",
  "realization", "puzzled", "calm_warm", "serious", "gentle_warning",
  "warm", "bright_confident", "encouraging",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** 演技パターン（§4の9種）。同じ文でも delivery で読み方が変わる。 */
export const DELIVERY_STYLES = [
  "hook_tension", "reveal", "explain_calm", "question_naive", "reaction",
  "caution", "empathy", "summary_confident", "cta",
] as const;
export type DeliveryStyle = (typeof DELIVERY_STYLES)[number];

export const SPEAKING_RATES = ["slow", "normal", "fast"] as const;
export type SpeakingRate = (typeof SPEAKING_RATES)[number];

export const PAUSES = ["none", "short", "medium", "long"] as const;
export type Pause = (typeof PAUSES)[number];

export const TRANSITIONS = ["cut", "slide", "fade"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const CAMERA_MOTIONS = ["none", "push_in", "pan"] as const;
export type CameraMotion = (typeof CAMERA_MOTIONS)[number];

export const BGM_ACTIONS = ["continue", "swell", "duck", "change"] as const;
export type BgmAction = (typeof BGM_ACTIONS)[number];

/** 既存 character_assets(00015) の表情4種。emotion からこの4種を導出する（§7）。 */
export const EXPRESSIONS = ["normal", "happy", "surprised", "thinking"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/** emotion → 表情（4種）マップ。character_expression を独立フィールドにせず導出する。 */
const EMOTION_TO_EXPRESSION: Record<Emotion, Expression> = {
  neutral: "normal",
  curious: "thinking",
  tension: "thinking",
  positive_surprise: "surprised",
  surprise: "surprised",
  realization: "happy",
  puzzled: "thinking",
  calm_warm: "normal",
  serious: "normal",
  gentle_warning: "normal",
  warm: "happy",
  bright_confident: "happy",
  encouraging: "happy",
};

export function emotionToExpression(emotion: Emotion): Expression {
  return EMOTION_TO_EXPRESSION[emotion] ?? "normal";
}

/** 図解の構造化データ（visual.type 別）。必要時のみ。 */
export interface ComparisonData {
  kind: "comparison";
  left: string;
  right: string;
  rows: { label: string; leftValue: string; rightValue: string }[];
  emphasis: string | null; // 最後に特大表示する差（「+約171万円」等）
}
export interface NumberAnimationData {
  kind: "number_animation";
  from: number;
  to: number;
  unit: string; // 円 / % / 年 …
  format: string | null; // "¥#,###" 等の任意フォーマットヒント
}
export interface ChartData {
  kind: "chart";
  chartKind: "bar" | "line" | "pie" | "area";
  series: { label: string; points: number[] }[];
}
export interface TimelineData {
  kind: "timeline";
  points: { year: string; label: string }[];
}
export interface ProcessData {
  kind: "process";
  steps: { title: string; detail: string }[];
}
export type Infographic =
  | ComparisonData | NumberAnimationData | ChartData | TimelineData | ProcessData;

/** 1発話（会話は複数、ナレは1）。M(音声演技)を満たす情報を持つ。 */
export interface SceneAudio {
  speaker: Speaker;
  text: string;
  emotion: Emotion;
  emotionIntensity: number; // 1–3
  deliveryStyle: DeliveryStyle;
  speakingRate: SpeakingRate;
  emphasis: string[]; // 強調する語
  pauseBefore: Pause;
  pauseAfter: Pause;
  pronunciation: { word: string; reading: string }[]; // NISA→ニーサ 等の読み固定
  syncTarget: string | null; // この発話の emphasis が結びつく画面/SEイベントID
}

/** 映像1レイヤー。 */
export interface SceneVisual {
  type: VisualType;
  description: string; // 就労者・確認用の日本語
  onScreenText: string[]; // テロップ＝強調語（字幕とは別役割）
  infographic: Infographic | null; // type別の構造化データ
  imagePrompt: string | null; // generated_video / broll / 背景 生成時のみ
  imageToVideoPrompt: string | null; // generated_video時のみ
  cameraMotion: CameraMotion;
  transitionIn: Transition;
  transitionOut: Transition;
}

/** SE。sync_target で発話・画面イベントに接続。 */
export interface SceneSe {
  cue: string; // pop_positive / drumroll / confirm …
  at: string; // "sync:zero" 等のイベント参照 or 秒
}

/** 1シーン（3〜10秒）。 */
export interface VideoScene {
  id: string;
  section: Section;
  startSec: number; // 暫定AI推定 → 音声合成後に実尺で確定
  endSec: number;
  visual: SceneVisual;
  audio: SceneAudio[];
  bgm: { track: string | null; action: BgmAction };
  se: SceneSe[];
  editingInstruction: string; // 就労者向け平易文
  requiredAsset: string[]; // bg / infographic.svg / narration.wav …
  qualityCheck: string[]; // シーン別合否（ルーブリック項目）
  source: { ref: string; confirmedDate: string; fiscalYear: string; needsCheck: boolean } | null;
}

/** 動画1本（PROJECT）。テーマ→章立て→SCENE[]。 */
export interface VideoProject {
  title: string; // 動画タイトル（視聴者向け）
  theme: string; // 生成の入力テーマ
  audience: string; // 想定視聴者
  goal: string; // この動画で理解させること
  targetMinutes: number; // 完成尺（分）
  scenes: VideoScene[];
}

// ---------- 正規化 ----------

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const oneOf = <T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Math.round(num(v, fallback));
  return Math.min(hi, Math.max(lo, n));
};

function normalizeInfographic(v: unknown, type: VisualType): Infographic | null {
  if (!isObj(v)) return null;
  const kindByType: Partial<Record<VisualType, Infographic["kind"]>> = {
    comparison: "comparison",
    number_animation: "number_animation",
    chart: "chart",
    timeline: "timeline",
    process: "process",
  };
  const kind = kindByType[type];
  if (!kind) return null;
  switch (kind) {
    case "comparison": {
      const rows = Array.isArray(v.rows) ? v.rows : [];
      return {
        kind, left: str(v.left), right: str(v.right),
        rows: rows.filter(isObj).map((r) => ({
          label: str(r.label), leftValue: str(r.leftValue), rightValue: str(r.rightValue),
        })),
        emphasis: typeof v.emphasis === "string" ? v.emphasis : null,
      };
    }
    case "number_animation":
      return {
        kind, from: num(v.from, 0), to: num(v.to, 0), unit: str(v.unit),
        format: typeof v.format === "string" ? v.format : null,
      };
    case "chart": {
      const series = Array.isArray(v.series) ? v.series : [];
      return {
        kind,
        chartKind: oneOf(v.chartKind, ["bar", "line", "pie", "area"] as const, "bar"),
        series: series.filter(isObj).map((s) => ({
          label: str(s.label),
          points: Array.isArray(s.points) ? s.points.map((p) => num(p, 0)) : [],
        })),
      };
    }
    case "timeline": {
      const points = Array.isArray(v.points) ? v.points : [];
      return { kind, points: points.filter(isObj).map((p) => ({ year: str(p.year), label: str(p.label) })) };
    }
    case "process": {
      const steps = Array.isArray(v.steps) ? v.steps : [];
      return { kind, steps: steps.filter(isObj).map((s) => ({ title: str(s.title), detail: str(s.detail) })) };
    }
  }
}

function normalizeAudio(v: unknown): SceneAudio | null {
  if (!isObj(v)) return null;
  const text = str(v.text);
  const pron = Array.isArray(v.pronunciation) ? v.pronunciation : [];
  return {
    speaker: oneOf(v.speaker, SPEAKERS, "narrator"),
    text,
    emotion: oneOf(v.emotion, EMOTIONS, "neutral"),
    emotionIntensity: clampInt(v.emotionIntensity, 1, 3, 2),
    deliveryStyle: oneOf(v.deliveryStyle, DELIVERY_STYLES, "explain_calm"),
    speakingRate: oneOf(v.speakingRate, SPEAKING_RATES, "normal"),
    emphasis: strArr(v.emphasis),
    pauseBefore: oneOf(v.pauseBefore, PAUSES, "none"),
    pauseAfter: oneOf(v.pauseAfter, PAUSES, "none"),
    pronunciation: pron.filter(isObj).map((p) => ({ word: str(p.word), reading: str(p.reading) }))
      .filter((p) => p.word && p.reading),
    syncTarget: typeof v.syncTarget === "string" ? v.syncTarget : null,
  };
}

function normalizeSource(v: unknown): VideoScene["source"] {
  if (!isObj(v)) return null;
  return {
    ref: str(v.ref), confirmedDate: str(v.confirmedDate), fiscalYear: str(v.fiscalYear),
    needsCheck: v.needsCheck === true,
  };
}

/** 1シーンを正規化。id/start/end は呼び出し側で order を渡して補正する。 */
export function normalizeScene(v: unknown, index: number): VideoScene {
  const o = isObj(v) ? v : {};
  const visualObj = isObj(o.visual) ? o.visual : {};
  const type = oneOf(visualObj.type, VISUAL_TYPES, "character_explanation");
  const audioRaw = Array.isArray(o.audio) ? o.audio : [];
  const audio = audioRaw.map(normalizeAudio).filter((a): a is SceneAudio => a !== null);
  const bgmObj = isObj(o.bgm) ? o.bgm : {};
  const seRaw = Array.isArray(o.se) ? o.se : [];
  const start = num(o.startSec, 0);
  const end = num(o.endSec, start + 6);
  return {
    id: str(o.id) || `scene_${String(index + 1).padStart(3, "0")}`,
    section: oneOf(o.section, SECTIONS, "basics"),
    startSec: start,
    endSec: end > start ? end : start + 6,
    visual: {
      type,
      description: str(visualObj.description),
      onScreenText: strArr(visualObj.onScreenText),
      infographic: normalizeInfographic(visualObj.infographic, type),
      imagePrompt: typeof visualObj.imagePrompt === "string" ? visualObj.imagePrompt : null,
      imageToVideoPrompt: typeof visualObj.imageToVideoPrompt === "string" ? visualObj.imageToVideoPrompt : null,
      cameraMotion: oneOf(visualObj.cameraMotion, CAMERA_MOTIONS, "none"),
      transitionIn: oneOf(visualObj.transitionIn, TRANSITIONS, "cut"),
      transitionOut: oneOf(visualObj.transitionOut, TRANSITIONS, "cut"),
    },
    audio,
    bgm: { track: typeof bgmObj.track === "string" ? bgmObj.track : null, action: oneOf(bgmObj.action, BGM_ACTIONS, "continue") },
    se: seRaw.filter(isObj).map((s) => ({ cue: str(s.cue), at: str(s.at) })).filter((s) => s.cue),
    editingInstruction: str(o.editingInstruction),
    requiredAsset: strArr(o.requiredAsset),
    qualityCheck: strArr(o.qualityCheck),
    source: normalizeSource(o.source),
  };
}

/** PROJECT全体を正規化。scene id/order を連番で振り直す。 */
export function normalizeVideoProject(v: unknown, themeFallback = ""): VideoProject {
  const o = isObj(v) ? v : {};
  const scenesRaw = Array.isArray(o.scenes) ? o.scenes : [];
  const scenes = scenesRaw.map((s, i) => {
    const scene = normalizeScene(s, i);
    return { ...scene, id: `scene_${String(i + 1).padStart(3, "0")}` };
  });
  return {
    title: str(o.title) || "無題の動画",
    theme: str(o.theme) || themeFallback,
    audience: str(o.audience) || "投資初心者",
    goal: str(o.goal),
    targetMinutes: clampInt(o.targetMinutes, 1, 30, 10),
    scenes,
  };
}
