/**
 * VideoProject（AI生成の設計図）→ 納品仕様書。
 *
 * クライアントに「完成見本動画＋仕様書＋データ」を見せる導線(トラックA)の“仕様書”部分。
 * SCENEデータを人が読める仕様に整形し、Markdown化する。就労者の作業指示の元にもなる。
 * 画面には出さない description(演出メモ)は仕様書には載せる（編集の指示になるため）。
 */

import type { VideoProject, VideoScene, Speaker, VisualType, Section } from "./schema";
import { validateVideoProject } from "./validate";

const SECTION_JA: Record<Section, string> = {
  hook: "導入・フック", problem: "問題提起", basics: "基礎説明", example: "具体例",
  dialogue: "疑問と誤解", caution: "注意点", summary: "まとめ", cta: "行動喚起",
};
const VISUAL_JA: Record<VisualType, string> = {
  comparison: "比較図", number_animation: "数字アニメーション", chart: "グラフ", infographic: "概念図",
  character_conversation: "キャラ会話", character_explanation: "キャラ解説", text_emphasis: "強調テロップ",
  timeline: "年表", process: "手順図", recap: "要点まとめ", generated_video: "AI生成映像", broll: "実写素材",
};
const SPEAKER_JA: Record<Speaker, string> = { narrator: "ナレーション", mina: "ミナ先生", haru: "ハル" };

export interface SpecScene {
  no: number;
  id: string;
  section: string;
  visualType: string;
  onScreenText: string[];
  lines: { speaker: string; text: string; emphasis: string[] }[];
  editing: string;
  assets: string[];
  checks: string[];
  source: { ref: string; needsCheck: boolean } | null;
  note: string; // 演出メモ(description)
}

export interface VideoSpec {
  title: string;
  theme: string;
  audience: string;
  goal: string;
  estimatedMinutes: number;
  sceneCount: number;
  format: { resolution: string; fps: number; aspect: string; container: string };
  sectionFlow: { section: string; scenes: number[] }[];
  scenes: SpecScene[];
  assetList: string[];
  qualityCriteria: string[];
  sourceNotes: { no: number; ref: string }[];
}

function specScene(scene: VideoScene, no: number): SpecScene {
  return {
    no,
    id: scene.id,
    section: SECTION_JA[scene.section] ?? scene.section,
    visualType: VISUAL_JA[scene.visual.type] ?? scene.visual.type,
    onScreenText: scene.visual.onScreenText,
    lines: scene.audio.map((a) => ({ speaker: SPEAKER_JA[a.speaker] ?? a.speaker, text: a.text, emphasis: a.emphasis })),
    editing: scene.editingInstruction,
    assets: scene.requiredAsset,
    checks: scene.qualityCheck,
    source: scene.source ? { ref: scene.source.ref, needsCheck: scene.source.needsCheck } : null,
    note: scene.visual.description,
  };
}

/** VideoProject を納品仕様書の構造に変換する。 */
export function buildVideoSpec(project: VideoProject): VideoSpec {
  const report = validateVideoProject(project);
  const scenes = project.scenes.map((s, i) => specScene(s, i + 1));

  // section の流れ（連続をまとめる）
  const sectionFlow: { section: string; scenes: number[] }[] = [];
  scenes.forEach((s) => {
    const last = sectionFlow[sectionFlow.length - 1];
    if (last && last.section === s.section) last.scenes.push(s.no);
    else sectionFlow.push({ section: s.section, scenes: [s.no] });
  });

  const assetList = Array.from(new Set(scenes.flatMap((s) => s.assets))).sort();
  const qualityCriteria = Array.from(new Set(scenes.flatMap((s) => s.checks)));
  const sourceNotes = scenes.filter((s) => s.source).map((s) => ({ no: s.no, ref: s.source!.ref }));

  return {
    title: project.title,
    theme: project.theme,
    audience: project.audience,
    goal: project.goal,
    estimatedMinutes: Math.round((report.estimatedSec / 60) * 10) / 10,
    sceneCount: scenes.length,
    format: { resolution: "1280x720", fps: 30, aspect: "16:9", container: "mp4 (H.264)" },
    sectionFlow,
    scenes,
    assetList,
    qualityCriteria,
    sourceNotes,
  };
}

/** 仕様書を Markdown に整形する（クライアント向け・就労者向けの土台）。 */
export function videoSpecToMarkdown(spec: VideoSpec): string {
  const L: string[] = [];
  L.push(`# 動画制作仕様書：${spec.title}`);
  L.push("");
  L.push("## 1. 概要");
  L.push(`- **テーマ**：${spec.theme}`);
  L.push(`- **想定視聴者**：${spec.audience}`);
  L.push(`- **この動画の目的（結論）**：${spec.goal}`);
  L.push(`- **想定尺**：約 ${spec.estimatedMinutes} 分（全 ${spec.sceneCount} シーン）`);
  L.push(`- **仕様**：${spec.format.resolution} / ${spec.format.fps}fps / ${spec.format.aspect} / ${spec.format.container}`);
  L.push("");
  L.push("## 2. 構成の流れ");
  spec.sectionFlow.forEach((f, i) => {
    L.push(`${i + 1}. **${f.section}**（シーン ${f.scenes.join("・")}）`);
  });
  L.push("");
  L.push("## 3. シーン別仕様");
  spec.scenes.forEach((s) => {
    L.push("");
    L.push(`### シーン ${s.no}（${s.section}／${s.visualType}）`);
    if (s.note) L.push(`- **画面**：${s.note}`);
    if (s.onScreenText.length) L.push(`- **テロップ**：${s.onScreenText.join(" / ")}`);
    if (s.lines.length) {
      L.push(`- **音声（セリフ）**：`);
      s.lines.forEach((ln) => L.push(`    - ${ln.speaker}：「${ln.text}」${ln.emphasis.length ? `（強調：${ln.emphasis.join("・")}）` : ""}`));
    }
    if (s.editing) L.push(`- **編集指示**：${s.editing}`);
    if (s.assets.length) L.push(`- **使用素材**：${s.assets.join(" / ")}`);
    if (s.checks.length) L.push(`- **品質チェック**：${s.checks.join(" / ")}`);
    if (s.source) L.push(`- **出典（要確認）**：${s.source.ref}`);
  });
  L.push("");
  L.push("## 4. 使用素材リスト");
  spec.assetList.forEach((a) => L.push(`- ${a}`));
  L.push("");
  L.push("## 5. 品質チェック項目");
  spec.qualityCriteria.forEach((c) => L.push(`- ${c}`));
  if (spec.sourceNotes.length) {
    L.push("");
    L.push("## 6. 出典・確認事項（数値・制度）");
    spec.sourceNotes.forEach((n) => L.push(`- シーン${n.no}：${n.ref}（一次情報で要確認）`));
  }
  return L.join("\n");
}
