"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, createClient } from "@/lib/supabase/server";
import { generateSimilarCase, generateCaseGuide } from "@/lib/ai";
import type { GeneratedSimilarCase, GeneratedCaseGuide } from "@/lib/ai";
import type { ManualStep } from "@/lib/types";
import { editingPatternToPromptBlock, type EditingPattern } from "@/lib/video/analysis/types";
import type { ActionState } from "./assignments";

/** 解析済み取り込み(video_ingests)の編集パターンを生成注入用テキストに変換する */
async function loadEditingPatternContext(ingestId: string): Promise<string | undefined> {
  if (!ingestId) return undefined;
  const supabase = await createClient();
  const { data } = await supabase
    .from("video_ingests")
    .select("editing_pattern, status")
    .eq("id", ingestId)
    .maybeSingle();
  if (!data || data.status !== "analyzed" || !data.editing_pattern) return undefined;
  return editingPatternToPromptBlock(data.editing_pattern as EditingPattern);
}

const MAX_CASE_TEXT_LENGTH = 20000;

export interface SimilarCasePreviewState extends ActionState {
  preview?: GeneratedSimilarCase & { provider: string };
  rawCaseText?: string;
  traineeNote?: string;
}

/** 実案件テキストから類似模擬案件を生成し、保存せずプレビューとして返す */
export async function previewSimilarCase(
  _prev: SimilarCasePreviewState,
  formData: FormData,
): Promise<SimilarCasePreviewState> {
  await requireRole("staff", "admin");

  const rawCaseText = String(formData.get("raw_case_text") ?? "").trim();
  const difficultyRaw = String(formData.get("difficulty") ?? "").trim();
  const traineeNote = String(formData.get("trainee_note") ?? "").trim();
  const ingestId = String(formData.get("ingest_id") ?? "").trim();

  if (!rawCaseText) {
    return { error: "実案件の依頼文を貼り付けてください。" };
  }
  if (rawCaseText.length > MAX_CASE_TEXT_LENGTH) {
    return { error: "依頼文が長すぎます（2万文字以内にしてください）。", rawCaseText, traineeNote };
  }
  const difficulty = difficultyRaw ? Number(difficultyRaw) : undefined;
  if (
    difficulty !== undefined &&
    (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
  ) {
    return { error: "難易度は1〜5で指定してください。", rawCaseText, traineeNote };
  }

  try {
    const editingPatternContext = await loadEditingPatternContext(ingestId);
    const preview = await generateSimilarCase({
      rawCaseText,
      difficulty,
      traineeNote: traineeNote || undefined,
      editingPatternContext,
    });
    return { error: null, preview, rawCaseText, traineeNote };
  } catch (err) {
    console.error("類似模擬案件の生成に失敗:", err);
    return {
      error: "AIによる生成に失敗しました。もう一度試してください。",
      rawCaseText,
      traineeNote,
    };
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** プレビュー確認後の保存ペイロードの検証（クライアント経由のため信頼しない） */
function parsePayload(json: string): GeneratedSimilarCase | null {
  let p: GeneratedSimilarCase;
  try {
    p = JSON.parse(json) as GeneratedSimilarCase;
  } catch {
    return null;
  }
  if (!isStringArray(p.cautionPoints)) p = { ...p, cautionPoints: [] };
  const valid =
    typeof p.title === "string" && p.title.length > 0 &&
    typeof p.summary === "string" &&
    typeof p.requestDoc === "string" && p.requestDoc.length > 0 &&
    Array.isArray(p.manualSteps) &&
    p.manualSteps.every((s) => typeof s?.text === "string") &&
    (p.script === null || typeof p.script === "string") &&
    isStringArray(p.selfCheckItems) &&
    typeof p.revisionNote === "string" &&
    typeof p.sampleDescription === "string" &&
    typeof p.maskedCaseText === "string" &&
    isStringArray(p.maskingReport?.removedItems) &&
    isStringArray(p.maskingReport?.riskNotes) &&
    isStringArray(p.skillTags) &&
    Number.isInteger(p.difficulty) && p.difficulty >= 1 && p.difficulty <= 5 &&
    typeof p.estimatedMinutes === "number" &&
    typeof p.dueInDays === "number";
  return valid ? p : null;
}

/** プレビューを職員が確認したあと、下書き課題として保存する */
export async function saveSimilarCase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const generated = parsePayload(String(formData.get("payload") ?? ""));
  if (!generated) {
    return { error: "保存データが不正です。もう一度生成からやり直してください。" };
  }

  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .insert({
      type: "practice",
      status: "draft",
      title: generated.title,
      summary: generated.summary,
      difficulty: generated.difficulty,
      skill_tags: generated.skillTags,
      estimated_minutes: Math.max(1, Math.round(generated.estimatedMinutes)),
      due_in_days: Math.max(1, Math.round(generated.dueInDays)),
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (tErr || !task) return { error: "課題の保存に失敗しました。" };

  const materials = [
    {
      task_id: task.id,
      kind: "request_doc",
      title: "お仕事の依頼書（練習用）",
      content: generated.requestDoc,
      sort_order: 0,
      generated_by: "ai",
      is_approved: false,
    },
    ...(generated.script
      ? [
          {
            task_id: task.id,
            kind: "script" as const,
            title: "字幕用の台本",
            content: generated.script,
            sort_order: 2,
            generated_by: "ai" as const,
            is_approved: false,
          },
        ]
      : []),
    {
      task_id: task.id,
      kind: "sample",
      title: "完成見本の説明",
      content: generated.sampleDescription,
      sort_order: 3,
      generated_by: "ai",
      is_approved: false,
    },
    // 利用者画面は sort_order 昇順の最初の revision_note をチェックリストとして
    // 読むため、チェックリスト(9)を修正指示(10)より前に置くこと
    {
      task_id: task.id,
      kind: "revision_note",
      title: "納品前チェックリスト",
      content: JSON.stringify(generated.selfCheckItems),
      sort_order: 9,
      generated_by: "ai",
      is_approved: false,
    },
    {
      task_id: task.id,
      kind: "revision_note",
      title: "修正指示（模擬クライアントから・初回納品後に使用）",
      content: generated.revisionNote,
      sort_order: 10,
      generated_by: "ai",
      is_approved: false,
    },
  ];

  const { error: mErr } = await supabase.from("task_materials").insert(materials);
  if (mErr) return { error: "教材の保存に失敗しました。" };

  // 匿名化済み案件をナレッジへ自動蓄積（模擬案件生成時の参考情報になる。
  // テーブル未適用などで失敗しても課題保存は成立させる）
  const { error: kErr } = await supabase.from("case_knowledge").insert({
    title: `実案件由来: ${generated.title.replace(/^【練習】/, "")}`,
    genre: generated.genre,
    skill_tags: generated.skillTags,
    difficulty: generated.difficulty,
    caution_points: generated.cautionPoints,
    masked_case_text: generated.maskedCaseText,
    masking_report: generated.maskingReport,
    source: "real_case",
    converted_task_id: task.id,
    created_by: staff.id,
  });
  if (kErr) {
    console.error(
      "実案件ナレッジの保存に失敗（課題は保存済み）。migration 00005_case_knowledge.sql が適用済みか確認してください:",
      kErr,
    );
  }

  revalidatePath("/staff");
  revalidatePath("/staff/cases/new");
  redirect(`/staff/tasks/${task.id}`);
}

// ============================================================================
// CrowdWorks案件の「配布」フロー（実案件をそのまま利用者に配る）
//
// 別案件を作る（generateSimilarCase）のとは別。実案件そのものを task(type='real') と
// して登録し、AIが用意した読みやすい依頼書＋手順書を付けて、選んだ利用者に配布する。
// 職員がプレビューで確認して「配布」を押した時点で承認とみなし、公開＋割当まで行う。
// ============================================================================

export interface CaseGuidePreviewState extends ActionState {
  guide?: GeneratedCaseGuide & { provider: string };
  caseText?: string;
  traineeNote?: string;
}

/** 実案件テキストから配布用ガイド（依頼書＋手順書）を生成し、保存せずプレビューを返す */
export async function previewCaseGuide(
  _prev: CaseGuidePreviewState,
  formData: FormData,
): Promise<CaseGuidePreviewState> {
  await requireRole("staff", "admin");

  const caseText = String(formData.get("case_text") ?? "").trim();
  const traineeNote = String(formData.get("trainee_note") ?? "").trim();

  if (!caseText) return { error: "案件の依頼文を貼り付けてください。" };
  if (caseText.length > MAX_CASE_TEXT_LENGTH) {
    return { error: "依頼文が長すぎます（2万文字以内にしてください）。", caseText, traineeNote };
  }

  try {
    const guide = await generateCaseGuide({ caseText, traineeNote: traineeNote || undefined });
    return { error: null, guide, caseText, traineeNote };
  } catch (err) {
    console.error("配布用ガイドの生成に失敗:", err);
    return { error: "AIによる生成に失敗しました。もう一度試してください。", caseText, traineeNote };
  }
}

function isManualStepArray(value: unknown): value is ManualStep[] {
  return Array.isArray(value) && value.every((s) => typeof (s as ManualStep)?.text === "string");
}

/** クライアント経由のガイドペイロードを検証（信頼しない） */
function parseGuidePayload(json: string): GeneratedCaseGuide | null {
  let p: GeneratedCaseGuide;
  try {
    p = JSON.parse(json) as GeneratedCaseGuide;
  } catch {
    return null;
  }
  const valid =
    typeof p.title === "string" && p.title.length > 0 &&
    typeof p.summary === "string" &&
    typeof p.readableRequestDoc === "string" && p.readableRequestDoc.length > 0 &&
    isManualStepArray(p.manualSteps) &&
    isStringArray(p.skillTags) &&
    isStringArray(p.selfCheckItems) &&
    Number.isInteger(p.difficulty) && p.difficulty >= 1 && p.difficulty <= 5 &&
    typeof p.estimatedMinutes === "number";
  return valid ? p : null;
}

/**
 * 実案件を選んだ利用者に配布する。
 * task(type='real', status='published') ＋ 承認済み教材（依頼書・手順書・チェックリスト）を作り、
 * 指定利用者に割り当てる。裏でナレッジにも蓄積する（AI模擬案件の質向上に使う）。
 */
export async function distributeRealCase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const guide = parseGuidePayload(String(formData.get("payload") ?? ""));
  if (!guide) {
    return { error: "配布データが不正です。もう一度生成からやり直してください。" };
  }
  const caseText = String(formData.get("case_text") ?? "").trim();
  const userIds = formData.getAll("user_ids").map(String).filter(Boolean);
  const dueDays = Math.max(1, Math.round(Number(formData.get("due_days") ?? 5)));

  if (userIds.length === 0) {
    return { error: "配布する利用者を1人以上選んでください。" };
  }

  // 1. 実案件を task として登録（承認済み・公開）
  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .insert({
      type: "real",
      status: "published",
      title: guide.title,
      summary: guide.summary,
      difficulty: guide.difficulty,
      skill_tags: guide.skillTags,
      estimated_minutes: Math.max(1, Math.round(guide.estimatedMinutes)),
      due_in_days: dueDays,
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (tErr || !task) return { error: "案件の登録に失敗しました。" };

  const materials = [
    {
      task_id: task.id,
      kind: "request_doc",
      title: "お仕事の依頼書",
      content: guide.readableRequestDoc,
      sort_order: 0,
      generated_by: "ai",
      is_approved: true,
    },
    {
      task_id: task.id,
      kind: "revision_note",
      title: "納品前チェックリスト",
      content: JSON.stringify(guide.selfCheckItems),
      sort_order: 9,
      generated_by: "ai",
      is_approved: true,
    },
  ];
  const { error: mErr } = await supabase.from("task_materials").insert(materials);
  if (mErr) return { error: "教材の保存に失敗しました。" };

  // 2. 選んだ利用者に配布（割当）
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + dueDays);
  const assignments = userIds.map((userId) => ({
    task_id: task.id,
    user_id: userId,
    status: "not_started" as const,
    due_at: dueAt.toISOString(),
    assigned_by: staff.id,
  }));
  const { error: aErr } = await supabase.from("task_assignments").insert(assignments);
  if (aErr) {
    return { error: "案件は登録しましたが、利用者への配布に失敗しました。案件管理から割り当ててください。" };
  }

  // 3. 裏方: 案件をナレッジに蓄積（AI模擬案件の質向上に使う。失敗しても配布は成立させる）
  if (caseText) {
    const { error: kErr } = await supabase.from("case_knowledge").insert({
      title: `実案件: ${guide.title}`,
      genre: null,
      skill_tags: guide.skillTags,
      difficulty: guide.difficulty,
      caution_points: [],
      masked_case_text: guide.readableRequestDoc,
      masking_report: { removedItems: [], riskNotes: [] },
      source: "real_case",
      converted_task_id: task.id,
      created_by: staff.id,
    });
    if (kErr) {
      console.error("実案件ナレッジの保存に失敗（配布は完了）:", kErr);
    }
  }

  revalidatePath("/staff");
  revalidatePath("/staff/cases/new");
  redirect(`/staff/tasks/${task.id}`);
}
