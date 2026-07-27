// テンプレート: interview_edit（対談・インタビュー編集）
// 聞き手/話し手2人の「未編集の収録」を模した台本。kind=cut のセグメントは
// フィラー・言い間違い・沈黙・言い直しで、就労者が取り除く対象になる。
// これにより「未編集素材（全セグメント）」と「完成見本（keepのみ）」を
// 同じ台本から機械的に両方生成できる。
import type { TemplateScriptBase, TemplateSceneBase } from "./types";

export const INTERVIEW_VOICES = [
  { id: "interviewer", name: "聞き手", subtitleColor: "#7C3AED", pitchFactor: 1.08, rate: 0 },
  { id: "interviewee", name: "話し手", subtitleColor: "#EA580C", pitchFactor: 1.0, rate: -1 },
] as const;
export type InterviewVoiceId = (typeof INTERVIEW_VOICES)[number]["id"];

export const CUT_REASONS = ["filler", "mistake", "silence", "retake"] as const;
export type CutReason = (typeof CUT_REASONS)[number];

export interface InterviewSegment extends TemplateSceneBase {
  speakerId: InterviewVoiceId;
  kind: "keep" | "cut";
  cutReason: CutReason | null;
  silenceSeconds: number | null; // kind=cut && cutReason=silence のときのみ
}

export interface InterviewEditScript extends TemplateScriptBase {
  templateType: "interview_edit";
  scenes: InterviewSegment[];
}

const MAX_SCENES = 60;
const MAX_NARRATION_LENGTH = 200;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateSegment(raw: unknown, index: number, errors: string[]): InterviewSegment | null {
  const s = raw as Partial<InterviewSegment>;
  const label = `scenes[${index}]`;
  if (s?.speakerId !== "interviewer" && s?.speakerId !== "interviewee") {
    errors.push(`${label}: speakerId が不正です（${String(s?.speakerId)}）`);
    return null;
  }
  const kind = s.kind === "cut" ? "cut" : "keep";
  const isSilence = kind === "cut" && s.cutReason === "silence";
  if (!isSilence && !isNonEmptyString(s.narration)) {
    errors.push(`${label}: narration が空です`);
    return null;
  }
  if (isNonEmptyString(s.narration) && s.narration.length > MAX_NARRATION_LENGTH) {
    errors.push(`${label}: narration が長すぎます（${MAX_NARRATION_LENGTH}文字以内）`);
    return null;
  }
  const cutReason: CutReason | null =
    kind === "cut" && CUT_REASONS.includes(s.cutReason as CutReason) ? (s.cutReason as CutReason) : kind === "cut" ? "filler" : null;
  return {
    id: isNonEmptyString(s.id) ? s.id : `scene_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    speakerId: s.speakerId,
    narration: isSilence ? "" : (s.narration ?? "").trim(),
    kind,
    cutReason,
    silenceSeconds: isSilence ? Math.min(6, Math.max(2, Number(s.silenceSeconds) || 3)) : null,
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

export function validateInterviewEditScript(
  raw: unknown,
  durationRange: { min: number; max: number; default: number },
): ValidationResult<InterviewEditScript> {
  const errors: string[] = [];
  const r = raw as Partial<InterviewEditScript>;
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

  const scenes: InterviewSegment[] = [];
  for (const [i, rawScene] of r.scenes.entries()) {
    const scene = validateSegment(rawScene, i, errors);
    if (scene) scenes.push(scene);
  }
  if (errors.length > 0) return { ok: false, errors };

  const cutCount = scenes.filter((s) => s.kind === "cut").length;
  if (cutCount < 2) {
    return { ok: false, errors: ["カット対象（フィラー・言い間違い・沈黙・言い直し）が少なすぎます（2件以上必要）"] };
  }
  const keepCount = scenes.filter((s) => s.kind === "keep").length;
  if (keepCount < 4) {
    return { ok: false, errors: ["残す発言（keep）が少なすぎます（4件以上必要）"] };
  }

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
      templateType: "interview_edit",
      title: r.title!.trim(),
      description: isNonEmptyString(r.description) ? r.description.trim() : "",
      targetDurationSec,
      scenes,
    },
  };
}

export function buildInterviewEditPrompt(theme: string, targetDurationSec: number, repairNote?: string): string {
  return `あなたは対談動画の構成作家です。「聞き手」と「話し手」による、テーマ「${theme}」についての対談の台本を作ってください。
これは編集練習用の素材のため、実際の収録のように「言い間違い・つなぎ言葉・沈黙・言い直し」を意図的に含めます。

条件:
- 完成後（カット後）の目標尺: 約${targetDurationSec}秒（読み上げは1秒あたり7文字で見積もる）
- 話者: interviewer（聞き手。質問・あいづち）と interviewee（話し手。テーマの専門家として回答）
- kind="keep": 完成版に残す、自然でまとまった発言
- kind="cut": 編集で取り除くべき部分。次を混ぜて4〜8個入れる
  - cutReason="filler": 「えーっと」「あのー」等のつなぎ言葉
  - cutReason="mistake": 言い間違い（直後のkeepで言い直す）
  - cutReason="retake": 同じ内容の失敗テイク
  - cutReason="silence": 沈黙。narrationは空文字にし、silenceSecondsに2〜5を入れる
- 全体の流れ: 挨拶・自己紹介 → 質問と回答を3〜4往復 → まとめ・締めの挨拶
- narration はそのまま音声合成されるため、ふりがな記法・記号・絵文字を入れない
- editingInstructions は就労者向けの編集指示を1シーンにつき0〜1個
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
      "speakerId": "interviewer",
      "narration": "string",
      "kind": "keep",
      "cutReason": null,
      "silenceSeconds": null,
      "editingInstructions": ["string"]
    }
  ]
}`;
}

export function mockInterviewEditScript(theme: string, targetDurationSec: number): InterviewEditScript {
  const raw = {
    title: `対談: ${theme}について聞いてみた`,
    description: `${theme}をテーマにした対談の未編集素材`,
    targetDurationSec,
    scenes: [
      { speakerId: "interviewer", narration: "本日はよろしくお願いします。早速ですが、テーマについて教えてください。", kind: "keep", editingInstructions: ["冒頭の挨拶を残す"] },
      { speakerId: "interviewee", narration: "えー、あのー。", kind: "cut", cutReason: "filler" },
      { speakerId: "interviewee", narration: "はい、よろしくお願いします。まずは基本からお話しします。", kind: "keep" },
      { speakerId: "interviewer", narration: "なるほど、具体的にはどういうことでしょうか。", kind: "keep" },
      { speakerId: "interviewee", narration: "それはですね、あ、すみません、言い方を変えます。", kind: "cut", cutReason: "mistake" },
      { speakerId: "interviewee", narration: "簡単に言うと、身近な例で考えると分かりやすいということです。", kind: "keep" },
      { speakerId: "interviewer", narration: "", kind: "cut", cutReason: "silence", silenceSeconds: 3 },
      { speakerId: "interviewer", narration: "なるほど、とても分かりやすいです。もう少し詳しく伺えますか。", kind: "keep" },
      { speakerId: "interviewee", narration: "詳しく言うと、えっと、ちょっと待ってください。", kind: "cut", cutReason: "retake" },
      { speakerId: "interviewee", narration: "詳しく言うと、続けることが一番大切なポイントです。", kind: "keep" },
      { speakerId: "interviewer", narration: "本日は貴重なお話をありがとうございました。", kind: "keep", editingInstructions: ["締めの挨拶を残す"] },
      { speakerId: "interviewee", narration: "こちらこそ、ありがとうございました。", kind: "keep" },
    ],
  };
  const result = validateInterviewEditScript(raw, { min: 60, max: 240, default: 90 });
  if (!result.ok || !result.script) throw new Error(`モック台本が検証に失敗: ${result.errors.join(", ")}`);
  return result.script;
}
