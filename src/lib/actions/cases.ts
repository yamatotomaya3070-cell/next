"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, createClient } from "@/lib/supabase/server";
import { generateSimilarCase } from "@/lib/ai";
import type { GeneratedSimilarCase } from "@/lib/ai";
import type { ActionState } from "./assignments";

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
    const preview = await generateSimilarCase({
      rawCaseText,
      difficulty,
      traineeNote: traineeNote || undefined,
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
    {
      task_id: task.id,
      kind: "manual",
      title: "作業のやり方（手順書）",
      steps: generated.manualSteps,
      sort_order: 1,
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

  // 匿名化済み案件をナレッジベースへ（将来のRAG移行元。失敗しても課題保存は成立）
  const { error: kErr } = await supabase.from("knowledge_base").insert({
    title: `実案件由来: ${generated.title}`,
    source_summary: generated.maskedCaseText,
    content: {
      genre: generated.genre,
      skill_tags: generated.skillTags,
      difficulty: generated.difficulty,
      masking_report: generated.maskingReport,
    },
    is_anonymized: true,
    consent_confirmed: false,
    created_by: staff.id,
  });
  if (kErr) {
    console.error("ナレッジベースへの保存に失敗（課題は保存済み）:", kErr);
  }

  revalidatePath("/staff");
  redirect(`/staff/tasks/${task.id}`);
}
