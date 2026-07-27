// テンプレート: business_explainer（ビジネス・教育系解説）
// 1人のナレーターが進行するスライド形式。台本の構造がキャラクター系と異なるため独自スキーマにする。
import type { TemplateScriptBase, TemplateSceneBase } from "./types";

export const NARRATOR_VOICE = { id: "narrator", name: "ナレーター", subtitleColor: "#334155", pitchFactor: 1.0, rate: -1 } as const;

export interface SlideScene extends TemplateSceneBase {
  slideTitle: string;
  bulletPoints: string[]; // 0〜4個
}

export interface BusinessExplainerScript extends TemplateScriptBase {
  templateType: "business_explainer";
  scenes: SlideScene[];
}

const MAX_SCENES = 24;
const MAX_NARRATION_LENGTH = 260;
const MAX_BULLETS = 4;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateScene(raw: unknown, index: number, errors: string[]): SlideScene | null {
  const s = raw as Partial<SlideScene>;
  const label = `scenes[${index}]`;
  if (!isNonEmptyString(s?.narration)) {
    errors.push(`${label}: narration が空です`);
    return null;
  }
  if (s.narration.length > MAX_NARRATION_LENGTH) {
    errors.push(`${label}: narration が長すぎます（${MAX_NARRATION_LENGTH}文字以内）`);
    return null;
  }
  if (!isNonEmptyString(s.slideTitle)) {
    errors.push(`${label}: slideTitle が空です`);
    return null;
  }
  return {
    id: isNonEmptyString(s.id) ? s.id : `scene_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    narration: s.narration.trim(),
    slideTitle: s.slideTitle.trim(),
    bulletPoints: Array.isArray(s.bulletPoints)
      ? s.bulletPoints.filter(isNonEmptyString).map((t) => t.trim()).slice(0, MAX_BULLETS)
      : [],
    editingInstructions: Array.isArray(s.editingInstructions)
      ? s.editingInstructions.filter(isNonEmptyString).map((t) => t.trim())
      : [],
  };
}

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  script?: T;
}

export function validateBusinessExplainerScript(
  raw: unknown,
  durationRange: { min: number; max: number; default: number },
): ValidationResult<BusinessExplainerScript> {
  const errors: string[] = [];
  const r = raw as Partial<BusinessExplainerScript>;
  if (!r || typeof r !== "object") return { ok: false, errors: ["台本がJSONオブジェクトではありません"] };
  if (!isNonEmptyString(r.title)) errors.push("title が空です");
  if (!Array.isArray(r.scenes) || r.scenes.length === 0) {
    errors.push("scenes が空です");
    return { ok: false, errors };
  }
  if (r.scenes.length > MAX_SCENES) {
    errors.push(`scenes が多すぎます（${MAX_SCENES}以内）`);
    return { ok: false, errors };
  }

  const scenes: SlideScene[] = [];
  for (const [i, rawScene] of r.scenes.entries()) {
    const scene = validateScene(rawScene, i, errors);
    if (scene) scenes.push(scene);
  }
  if (errors.length > 0) return { ok: false, errors };

  const targetDurationSec =
    typeof r.targetDurationSec === "number" &&
    r.targetDurationSec >= durationRange.min &&
    r.targetDurationSec <= durationRange.max
      ? Math.round(r.targetDurationSec)
      : durationRange.default;

  return {
    ok: true,
    errors: [],
    script: {
      templateType: "business_explainer",
      title: r.title!.trim(),
      description: isNonEmptyString(r.description) ? r.description.trim() : "",
      targetDurationSec,
      scenes,
    },
  };
}

export function buildBusinessExplainerPrompt(theme: string, targetDurationSec: number, repairNote?: string): string {
  const sceneCount = Math.max(5, Math.min(14, Math.round(targetDurationSec / 12)));
  return `あなたはビジネス・教育系の解説動画を作る構成作家です。1人のナレーターが進行する、スライド形式の解説動画の台本を作ってください。

条件:
- テーマ: ${theme}
- 目標尺: 約${targetDurationSec}秒（読み上げは1秒あたり7文字で見積もる）
- スライド数: ${sceneCount}前後
- トーンは落ち着いた、信頼感のある説明口調（キャラクターの掛け合いではない）
- 構成: 導入（テーマと結論の予告）→ 本編（要点ごとに1スライド）→ まとめ
- 1スライド = ナレーション1〜3文 + slideTitle（10文字以内）+ bulletPoints（0〜4個、各15文字以内）
- narration はそのまま音声合成されるため、ふりがな記法・記号・絵文字を入れない
- editingInstructions は就労者向けの編集指示を1〜2個
${repairNote ? `\n前回の出力には次の問題がありました。必ず修正してください:\n${repairNote}` : ""}

必ず有効なJSONのみを出力する。

JSONスキーマ:
{
  "title": "string",
  "description": "string",
  "targetDurationSec": ${targetDurationSec},
  "scenes": [
    {
      "id": "scene_001",
      "order": 1,
      "narration": "string",
      "slideTitle": "string",
      "bulletPoints": ["string"],
      "editingInstructions": ["string"]
    }
  ]
}`;
}

export function mockBusinessExplainerScript(theme: string, targetDurationSec: number): BusinessExplainerScript {
  const raw = {
    title: `${theme}の基礎知識`,
    description: `${theme}についてスライド形式で解説する動画`,
    targetDurationSec,
    scenes: [
      { narration: `こんにちは。今回は${theme}について、要点を整理してご紹介します。`, slideTitle: "はじめに", bulletPoints: [], editingInstructions: ["冒頭にタイトルスライドを表示する"] },
      { narration: `まず押さえておきたいのは、基本となる考え方です。ここを理解すると、後の話がぐっと分かりやすくなります。`, slideTitle: "基本の考え方", bulletPoints: ["基本を押さえる", "全体像をつかむ"], editingInstructions: ["箇条書きを表示する"] },
      { narration: `次に、実務での活用場面を見ていきましょう。日常の業務の中にも、応用できる場面が多くあります。`, slideTitle: "活用場面", bulletPoints: ["業務での活用", "応用のヒント"], editingInstructions: ["箇条書きを1つずつ表示する"] },
      { narration: `最後に、注意しておきたいポイントです。ここを見落とすと、思わぬミスにつながることがあります。`, slideTitle: "注意点", bulletPoints: ["見落としやすい点", "対策"], editingInstructions: ["注意点を強調する"] },
      { narration: `以上、${theme}について要点をご紹介しました。ぜひ日々の業務に役立ててください。`, slideTitle: "まとめ", bulletPoints: [], editingInstructions: ["まとめスライドを表示する"] },
    ],
  };
  const result = validateBusinessExplainerScript(raw, { min: 60, max: 240, default: 90 });
  if (!result.ok || !result.script) throw new Error(`モック台本が検証に失敗: ${result.errors.join(", ")}`);
  return result.script;
}
