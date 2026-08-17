/**
 * SCENE / PROJECT の妥当性検証。AI生成結果が「見本品質の10分」を満たす骨格かを点検する。
 * normalize が構造を保証した後の意味的チェック（section網羅・尺・図解整合・出典）。
 * 破壊はしない＝warning のリストを返すだけ（生成の再試行・職員レビューの手掛かり）。
 */

import type { VideoProject, VideoScene, VisualType } from "./schema";

export interface SceneIssue {
  sceneId: string;
  level: "error" | "warn";
  message: string;
}

export interface ProjectReport {
  sceneCount: number;
  estimatedSec: number; // audio文字数からのざっくり推定（実尺は合成後に確定）
  sections: string[]; // 出現したsection
  missingSections: string[]; // §5の7段のうち欠けているもの
  issues: SceneIssue[];
  ok: boolean; // error が無ければ true
}

/** infographic を必須とする visual.type（構造化データが無いと図解が描けない） */
const NEEDS_INFOGRAPHIC: VisualType[] = [
  "comparison", "number_animation", "chart", "timeline", "process",
];
/** §5の骨格。フック〜CTAが最低限そろっているか。 */
const CORE_SECTIONS = ["hook", "basics", "example", "summary", "cta"] as const;

/** 発話テキストの文字数から尺を粗く推定（7字≒1秒、空は2秒）。実尺は音声合成後に確定。 */
function estimateSceneSec(scene: VideoScene): number {
  if (scene.audio.length === 0) return Math.max(2, scene.endSec - scene.startSec || 3);
  return scene.audio.reduce((sum, a) => sum + (a.text.trim() ? Math.max(1.2, a.text.length / 7) : 2), 0);
}

function checkScene(scene: VideoScene): SceneIssue[] {
  const issues: SceneIssue[] = [];
  const push = (level: SceneIssue["level"], message: string) =>
    issues.push({ sceneId: scene.id, level, message });

  if (scene.audio.length === 0) push("warn", "発話(audio)が無い＝無音シーン。意図的でなければナレを足す");
  for (const a of scene.audio) {
    if (!a.text.trim()) push("warn", `空の発話(speaker=${a.speaker})`);
  }
  if (NEEDS_INFOGRAPHIC.includes(scene.visual.type) && scene.visual.infographic === null) {
    push("error", `${scene.visual.type} は infographic 構造化データが必須だが欠落＝図解を描けない`);
  }
  if (scene.visual.type === "character_conversation" && scene.audio.length < 2) {
    push("warn", "character_conversation なのに発話が2未満＝掛け合いになっていない");
  }
  if (scene.visual.type === "generated_video" && !scene.visual.imageToVideoPrompt) {
    push("warn", "generated_video なのに image_to_video_prompt が無い");
  }
  // 数字・制度シーンは出典(K項目)が望ましい
  if ((scene.visual.type === "number_animation" || scene.section === "basics") && scene.source === null) {
    push("warn", "数値/制度シーンだが source(出典) 未設定＝K項目(金融正確性)の裏取り推奨");
  }
  return issues;
}

export function validateVideoProject(project: VideoProject): ProjectReport {
  const issues: SceneIssue[] = [];
  for (const scene of project.scenes) issues.push(...checkScene(scene));

  const sections = Array.from(new Set(project.scenes.map((s) => s.section)));
  const missingSections = CORE_SECTIONS.filter((s) => !sections.includes(s));
  for (const m of missingSections) {
    issues.push({ sceneId: "-", level: "warn", message: `骨格の section「${m}」が1つも無い` });
  }
  if (project.scenes.length === 0) {
    issues.push({ sceneId: "-", level: "error", message: "シーンが0件" });
  }

  const estimatedSec = project.scenes.reduce((sum, s) => sum + estimateSceneSec(s), 0);

  return {
    sceneCount: project.scenes.length,
    estimatedSec: Math.round(estimatedSec),
    sections,
    missingSections,
    issues,
    ok: !issues.some((i) => i.level === "error"),
  };
}
