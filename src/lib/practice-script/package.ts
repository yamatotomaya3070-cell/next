/**
 * 練習案件パッケージの組み立て（Stage4）。
 *
 * 台本(GeneratedPracticeScript) × 難易度(DifficultyProfile) × スタイルガイドから、
 * 就労者に配布する「編集前のバラバラ素材一式＋依頼書＋作業指示書」と、
 * 職員/AIレビュー専用の正解データ（完成見本の目標）を組み立てる純粋関数。
 *
 * 実際の素材動画(mp4)のレンダリングは既存の動画パイプライン(scripts/video/*)の役割で、
 * ここはその「設計図」（どのクリップをどう作り、何が正解か）を確定させる層。
 */

import type { StyleGuideContent } from "@/lib/style-guide/schema";
import type { DifficultyProfile, DifficultyTier } from "./difficulty";
import {
  practiceScriptStats,
  type CutReason,
  type GeneratedPracticeScript,
  type PracticeScriptSegment,
  type PracticeScriptStats,
  type SegmentPriority,
} from "./schema";

/** 就労者に渡す1つの素材クリップ */
export interface PracticeMaterialClip {
  id: string;
  order: number;
  filename: string; // 例: clip_001.mp4
  speakerKey: string;
  priority: SegmentPriority;
  estimatedSeconds: number;
  text: string; // 話している内容（字幕づくりの参考）
}

/** 職員/AIレビュー専用の正解データ（完成見本の目標） */
export interface PracticeAnswerData {
  targetKeepSeconds: number;
  toleranceSec: number;
  mustSegmentIds: string[]; // 残すべき素材
  optionalSegmentIds: string[]; // 切る候補
  cutReasonById: Record<string, CutReason>; // 切る候補の理由
}

export interface PracticeCasePackage {
  title: string;
  difficulty: DifficultyTier;
  requestDoc: string; // 依頼書（依頼メッセージ＋動画仕様。生テキスト）
  workInstructions: string[]; // 作業指示書（難易度連動）
  selfCheckItems: string[];
  materials: PracticeMaterialClip[]; // 配布する素材一式
  answerData: PracticeAnswerData; // 就労者には渡さない
  stats: PracticeScriptStats;
}

const CUT_REASON_LABELS: Record<CutReason, string> = {
  filler: "つなぎ言葉・言いよどみ",
  tangent: "本筋と関係ない雑談",
  redundant: "同じ内容のくり返し",
  weak: "あってもなくても良い弱い部分",
  ng: "使ってはいけない失敗テイク",
};

function clipFilename(order: number): string {
  return `clip_${String(order).padStart(3, "0")}.mp4`;
}

function toMaterial(segment: PracticeScriptSegment): PracticeMaterialClip {
  return {
    id: segment.id,
    order: segment.order,
    filename: clipFilename(segment.order),
    speakerKey: segment.speakerKey,
    priority: segment.priority,
    estimatedSeconds: segment.estimatedSeconds,
    text: segment.text,
  };
}

function buildRequestDoc(
  script: GeneratedPracticeScript,
  styleGuide: StyleGuideContent,
): string {
  const minutes = Math.round(script.targetKeepSeconds / 60);
  const lines: string[] = [];
  lines.push(script.clientMessage.trim());
  lines.push("");
  lines.push("【動画の仕様】");
  lines.push(`・完成の長さ：だいたい${minutes}分`);
  lines.push("・形式：mp4");
  lines.push(`・テロップ：${styleGuide.telopRules.fontMood}／${styleGuide.telopRules.position}`);
  lines.push("・テンポよく、いらない部分はカットしてください。");
  lines.push("");
  lines.push("【素材について】");
  lines.push("・素材はいくつかのクリップに分かれています。");
  lines.push("・使う素材と、使わない素材があります。自分で選んでください。");
  return lines.join("\n");
}

function buildWorkInstructions(
  script: GeneratedPracticeScript,
  profile: DifficultyProfile,
): string[] {
  const steps: string[] = [];
  steps.push("素材のクリップを最初にぜんぶ見て、内容をつかみましょう。");

  if (profile.revealCutTargets) {
    // やさしい: どれを切るか具体的に教える
    const cutList = script.segments
      .filter((s) => s.priority === "optional")
      .map((s) => `${clipFilename(s.order)}（${s.cutReason ? CUT_REASON_LABELS[s.cutReason] : "いらない部分"}）`);
    if (cutList.length > 0) {
      steps.push(`次のクリップはいらない部分です。使わないでください：${cutList.join("、")}`);
    }
    steps.push("残したクリップを、順番どおりに並べます。");
  } else if (profile.guidanceDetail === "medium") {
    steps.push("素材の中には「いらない部分」がまざっています。どれを使うか自分で判断して選びましょう。");
    steps.push("残すと決めたクリップを、自然な順番に並べます。");
  } else {
    // むずかしい: 実案件に近い簡素な指示
    steps.push("必要な素材だけを選び、見やすい1本の動画に仕上げてください。");
  }

  if (profile.guidanceDetail !== "low") {
    steps.push("話している内容に合わせて、テロップ（字幕）を入れます。");
    steps.push("クリップごとの音量をそろえて、聞きやすくします。");
  } else {
    steps.push("テロップ・音量・テンポを整えて仕上げます。");
  }

  steps.push("完成したら書き出して（mp4）、提出しましょう。");
  return steps;
}

function buildSelfCheckItems(
  script: GeneratedPracticeScript,
  profile: DifficultyProfile,
): string[] {
  const minutes = Math.round(script.targetKeepSeconds / 60);
  const items = [
    `完成の長さはだいたい${minutes}分になっていますか（前後${profile.toleranceSec}秒までOK）。`,
    "いらない部分（雑談・言いよどみ・失敗テイク）を切りましたか。",
    "クリップの順番は自然ですか。",
    "テロップは内容と合っていますか。",
    "音量はそろっていますか。",
    "mp4で書き出しましたか。",
  ];
  return items;
}

function buildAnswerData(
  script: GeneratedPracticeScript,
  profile: DifficultyProfile,
): PracticeAnswerData {
  const mustSegmentIds: string[] = [];
  const optionalSegmentIds: string[] = [];
  const cutReasonById: Record<string, CutReason> = {};
  for (const seg of script.segments) {
    if (seg.priority === "must") {
      mustSegmentIds.push(seg.id);
    } else {
      optionalSegmentIds.push(seg.id);
      if (seg.cutReason) cutReasonById[seg.id] = seg.cutReason;
    }
  }
  return {
    targetKeepSeconds: script.targetKeepSeconds,
    toleranceSec: profile.toleranceSec,
    mustSegmentIds,
    optionalSegmentIds,
    cutReasonById,
  };
}

/** 台本＋難易度＋スタイルガイドから、配布パッケージ一式を組み立てる */
export function buildPracticeCasePackage(
  script: GeneratedPracticeScript,
  profile: DifficultyProfile,
  styleGuide: StyleGuideContent,
): PracticeCasePackage {
  return {
    title: script.title,
    difficulty: profile.tier,
    requestDoc: buildRequestDoc(script, styleGuide),
    workInstructions: buildWorkInstructions(script, profile),
    selfCheckItems: buildSelfCheckItems(script, profile),
    materials: script.segments.map(toMaterial),
    answerData: buildAnswerData(script, profile),
    stats: practiceScriptStats(script),
  };
}
