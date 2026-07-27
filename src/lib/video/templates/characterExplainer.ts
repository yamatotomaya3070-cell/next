// テンプレート: character_explainer（キャラクター解説）
// 2人のオリジナルキャラクター「アオ」「ミドリ」の掛け合いで進む、ゆっくり解説風の台本。
import type { TemplateScriptBase, TemplateSceneBase } from "./types";

export const CHARACTER_VOICES = [
  { id: "speaker_a", name: "アオ", subtitleColor: "#2563EB", position: "left" as const, pitchFactor: 1.0, rate: 0 },
  { id: "speaker_b", name: "ミドリ", subtitleColor: "#16A34A", position: "right" as const, pitchFactor: 1.14, rate: 1 },
] as const;
export type CharacterVoiceId = (typeof CHARACTER_VOICES)[number]["id"];

export const CHARACTER_EXPRESSIONS = ["normal", "happy", "surprised"] as const;
export type CharacterExpression = (typeof CHARACTER_EXPRESSIONS)[number];

export interface CharacterScene extends TemplateSceneBase {
  speakerId: CharacterVoiceId;
  visualPrompt: string;
  characterExpression: CharacterExpression;
}

export interface CharacterExplainerScript extends TemplateScriptBase {
  templateType: "character_explainer";
  scenes: CharacterScene[];
}

const MAX_SCENES = 40;
const MAX_NARRATION_LENGTH = 200;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateScene(raw: unknown, index: number, errors: string[]): CharacterScene | null {
  const s = raw as Partial<CharacterScene>;
  const label = `scenes[${index}]`;
  if (!isNonEmptyString(s?.narration)) {
    errors.push(`${label}: narration が空です`);
    return null;
  }
  if (s.narration.length > MAX_NARRATION_LENGTH) {
    errors.push(`${label}: narration が長すぎます（${MAX_NARRATION_LENGTH}文字以内）`);
    return null;
  }
  if (s.speakerId !== "speaker_a" && s.speakerId !== "speaker_b") {
    errors.push(`${label}: speakerId が不正です（${String(s.speakerId)}）`);
    return null;
  }
  const expression = CHARACTER_EXPRESSIONS.includes(s.characterExpression as CharacterExpression)
    ? (s.characterExpression as CharacterExpression)
    : "normal";
  return {
    id: isNonEmptyString(s.id) ? s.id : `scene_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    speakerId: s.speakerId,
    narration: s.narration.trim(),
    visualPrompt: isNonEmptyString(s.visualPrompt) ? s.visualPrompt.trim() : "",
    characterExpression: expression,
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

export function validateCharacterExplainerScript(
  raw: unknown,
  durationRange: { min: number; max: number; default: number },
): ValidationResult<CharacterExplainerScript> {
  const errors: string[] = [];
  const r = raw as Partial<CharacterExplainerScript>;
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

  const scenes: CharacterScene[] = [];
  for (const [i, rawScene] of r.scenes.entries()) {
    const scene = validateScene(rawScene, i, errors);
    if (scene) scenes.push(scene);
  }
  if (errors.length > 0) return { ok: false, errors };

  const hasA = scenes.some((s) => s.speakerId === "speaker_a");
  const hasB = scenes.some((s) => s.speakerId === "speaker_b");
  if (!hasA || !hasB) return { ok: false, errors: ["2人の話者が両方登場していません"] };

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
      templateType: "character_explainer",
      title: r.title!.trim(),
      description: isNonEmptyString(r.description) ? r.description.trim() : "",
      targetDurationSec,
      scenes,
    },
  };
}

export function buildCharacterExplainerPrompt(
  theme: string,
  targetDurationSec: number,
  repairNote?: string,
): string {
  const sceneCount = Math.max(8, Math.min(24, Math.round(targetDurationSec / 5)));
  return `あなたはYouTubeの「ゆっくり解説」風動画の構成作家です。2人のオリジナルキャラクターの掛け合いで進む解説動画の台本を作ってください。

条件:
- テーマ: ${theme}
- 目標尺: 約${targetDurationSec}秒（読み上げは1秒あたり7文字で見積もる）
- シーン数: ${sceneCount}前後
- 話者: speaker_a「アオ」（進行役・ていねい）と speaker_b「ミドリ」（聞き役・素朴な疑問やあいづち）
- 2人が交互に話す掛け合い形式。ミドリの質問にアオが答える流れを基本にする
- 1シーン = 1人のひと続きのセリフ。60文字以内
- narration はそのまま音声合成されるため、ふりがな記法・記号・絵文字・かっこ書きを入れない
- 導入（あいさつとテーマ紹介）→ 本編（3〜4個のポイント）→ まとめ の構成
- characterExpression は "normal" | "happy" | "surprised" のみ
- editingInstructions は就労者（動画編集の練習をする人）向けの編集指示を1〜2個。平易な日本語
- visualPrompt は画面中央に表示する内容の短い説明（15文字以内）
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
      "speakerId": "speaker_a",
      "narration": "string",
      "visualPrompt": "string",
      "characterExpression": "normal",
      "editingInstructions": ["string"]
    }
  ]
}`;
}

export function mockCharacterExplainerScript(theme: string, targetDurationSec: number): CharacterExplainerScript {
  const raw = {
    title: `${theme}をやさしく解説`,
    description: `アオとミドリが${theme}について掛け合いで解説する動画`,
    targetDurationSec,
    scenes: [
      { speakerId: "speaker_a", narration: `こんにちは、アオです。今日は${theme}について、わかりやすく解説していきます。`, visualPrompt: "タイトル", characterExpression: "happy", editingInstructions: ["冒頭にタイトルを表示する", "アオの字幕を青色で入れる"] },
      { speakerId: "speaker_b", narration: `ミドリだよ。${theme}って、名前は聞いたことあるけど、実はよく知らないんだよね。`, visualPrompt: "はじまり", characterExpression: "normal", editingInstructions: ["ミドリの字幕を緑色で入れる"] },
      { speakerId: "speaker_a", narration: "だいじょうぶ。今日は3つのポイントにしぼって、順番に見ていきましょう。", visualPrompt: "3つのポイント", characterExpression: "normal", editingInstructions: ["ポイント一覧のカードを表示する"] },
      { speakerId: "speaker_b", narration: "3つだけなら、わたしにもおぼえられそう。はやく教えて。", visualPrompt: "3つのポイント", characterExpression: "happy", editingInstructions: ["前のシーンと同じカードを使う"] },
      { speakerId: "speaker_a", narration: "まず1つ目のポイントは、基本を知ることです。むずかしい言葉は後回しでかまいません。", visualPrompt: "ポイント1 基本", characterExpression: "normal", editingInstructions: ["ポイント1のカードを表示する"] },
      { speakerId: "speaker_b", narration: "なるほど。最初からぜんぶ覚えなくていいんだね。ちょっと安心したよ。", visualPrompt: "ポイント1 基本", characterExpression: "happy", editingInstructions: ["ミドリの表情をよろこびに切りかえる"] },
      { speakerId: "speaker_a", narration: "2つ目のポイントは、身近な例で考えることです。毎日の生活の中に例がたくさんあります。", visualPrompt: "ポイント2 身近な例", characterExpression: "normal", editingInstructions: ["ポイント2のカードを表示する"] },
      { speakerId: "speaker_b", narration: "えっ、そうなの。ぜんぜん気づかなかった。明日からちょっと意識してみようかな。", visualPrompt: "ポイント2 身近な例", characterExpression: "surprised", editingInstructions: ["ミドリの表情をおどろきに切りかえる"] },
      { speakerId: "speaker_a", narration: "3つ目のポイントは、少しずつ続けることです。一度にがんばりすぎないのがコツです。", visualPrompt: "ポイント3 続ける", characterExpression: "normal", editingInstructions: ["ポイント3のカードを表示する"] },
      { speakerId: "speaker_b", narration: "続けるのが苦手だけど、少しずつならできそうな気がしてきたよ。", visualPrompt: "ポイント3 続ける", characterExpression: "normal", editingInstructions: ["字幕の位置がそろっているか確認する"] },
      { speakerId: "speaker_a", narration: `今日は${theme}について、3つのポイントで解説しました。いかがでしたか。`, visualPrompt: "まとめ", characterExpression: "normal", editingInstructions: ["まとめのカードを表示する"] },
      { speakerId: "speaker_b", narration: "とてもよくわかったよ。みんなも、まずは1つ目のポイントからためしてみてね。", visualPrompt: "おわり", characterExpression: "happy", editingInstructions: ["最後にBGMをゆっくり小さくする"] },
    ],
  };
  const result = validateCharacterExplainerScript(raw, { min: 30, max: 300, default: 60 });
  if (!result.ok || !result.script) throw new Error(`モック台本が検証に失敗: ${result.errors.join(", ")}`);
  return result.script;
}
