"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole, createClient } from "@/lib/supabase/server";
import type { ManualGuideline, ManualStep } from "@/lib/types";
import type { ActionState } from "./assignments";

/**
 * 有効な手順ルール(manual_guidelines)を取得し、AIプロンプト用の文字列に整形する。
 * createTaskWithAi など生成の入口から呼び、generateTask の manualGuidelinesContext に渡す。
 * skillTags を渡すと「全案件向け(skill_tags 空)」＋「対象スキルが重なる」ルールに絞る。
 * テーブル未適用・0件でも空文字を返し、生成は継続できる。
 */
export async function buildManualGuidelinesContext(
  supabase: SupabaseClient,
  skillTags?: string[],
): Promise<string> {
  try {
    const { data } = await supabase
      .from("manual_guidelines")
      .select("title, rule, reason, example_before, example_after, skill_tags")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    let rows = (data ?? []) as Pick<
      ManualGuideline,
      "title" | "rule" | "reason" | "example_before" | "example_after" | "skill_tags"
    >[];

    // スキル指定があれば「全案件向け(空)」＋「重なるスキル」のみに絞る
    if (skillTags && skillTags.length > 0) {
      rows = rows.filter(
        (r) =>
          r.skill_tags.length === 0 ||
          r.skill_tags.some((t) => skillTags.includes(t)),
      );
    }
    if (rows.length === 0) return "";

    return rows
      .map((r, i) => {
        const lines = [`${i + 1}. ${r.rule}`, `   理由: ${r.reason}`];
        if (r.example_before) lines.push(`   NG例: ${r.example_before}`);
        if (r.example_after) lines.push(`   OK例: ${r.example_after}`);
        return lines.join("\n");
      })
      .join("\n");
  } catch (err) {
    console.error("手順ルールの取得に失敗（ルールなしで生成を続行）:", err);
    return "";
  }
}

/** 既存案件の手順書(steps)を書き換える。task_materials を直接更新し、即反映する。 */
export async function updateManualSteps(
  taskId: string,
  materialId: string,
  steps: ManualStep[],
): Promise<ActionState> {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  // 入力の正規化: 空テキストのステップは除外し、text/tip のみ残す
  const cleaned: ManualStep[] = (Array.isArray(steps) ? steps : [])
    .map((s) => ({
      text: String(s?.text ?? "").trim(),
      tip: s?.tip ? String(s.tip).trim() || null : null,
    }))
    .filter((s) => s.text.length > 0);

  if (cleaned.length === 0) {
    return { error: "手順を1つ以上入力してください。" };
  }

  const { error } = await supabase
    .from("task_materials")
    .update({ steps: cleaned })
    .eq("id", materialId)
    .eq("task_id", taskId)
    .eq("kind", "manual");
  if (error) return { error: "手順の保存に失敗しました。" };

  revalidatePath(`/staff/tasks/${taskId}`);
  revalidatePath("/staff/guidelines");
  return { error: null, success: true };
}

/**
 * 手順の修正を「学習ルール」として登録する（なぜ直したか＝reason 必須）。
 * 以後のAI手順生成に自動注入され、同じ間違いを繰り返さなくなる。
 */
export async function addManualGuideline(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const rule = String(formData.get("rule") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const exampleBefore = String(formData.get("example_before") ?? "").trim();
  const exampleAfter = String(formData.get("example_after") ?? "").trim();
  const skillTags = formData.getAll("skill_tags").map(String).filter(Boolean);
  const sourceTaskId = String(formData.get("source_task_id") ?? "").trim() || null;

  if (!title || !rule || !reason) {
    return { error: "見出し・ルール・理由（なぜ）はすべて入力してください。" };
  }

  const { error } = await supabase.from("manual_guidelines").insert({
    title,
    rule,
    reason,
    example_before: exampleBefore || null,
    example_after: exampleAfter || null,
    skill_tags: skillTags,
    source_task_id: sourceTaskId,
    created_by: staff.id,
  });
  if (error) {
    return {
      error:
        "ルールの保存に失敗しました（migration 00019_manual_guidelines.sql が未適用の可能性があります）。",
    };
  }

  if (sourceTaskId) revalidatePath(`/staff/tasks/${sourceTaskId}`);
  revalidatePath("/staff/guidelines");
  return { error: null, success: true };
}

/**
 * 既存の学習ルールを編集する（rule/reasonが曖昧・例が空だと生成への拘束力が弱いため、
 * 登録後に文言を強化できるようにする）。
 */
export async function updateManualGuideline(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const guidelineId = String(formData.get("guideline_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const rule = String(formData.get("rule") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const exampleBefore = String(formData.get("example_before") ?? "").trim();
  const exampleAfter = String(formData.get("example_after") ?? "").trim();
  const skillTags = formData.getAll("skill_tags").map(String).filter(Boolean);

  if (!guidelineId || !title || !rule || !reason) {
    return { error: "見出し・ルール・理由（なぜ）はすべて入力してください。" };
  }

  const { error } = await supabase
    .from("manual_guidelines")
    .update({
      title,
      rule,
      reason,
      example_before: exampleBefore || null,
      example_after: exampleAfter || null,
      skill_tags: skillTags,
    })
    .eq("id", guidelineId);
  if (error) return { error: "ルールの更新に失敗しました。" };

  revalidatePath("/staff/guidelines");
  return { error: null, success: true };
}

/** 学習ルールの有効/無効を切り替える（無効にすると以後の生成に注入されない）。 */
export async function setManualGuidelineActive(
  guidelineId: string,
  isActive: boolean,
): Promise<ActionState> {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_guidelines")
    .update({ is_active: isActive })
    .eq("id", guidelineId);
  if (error) return { error: "更新に失敗しました。" };
  revalidatePath("/staff/guidelines");
  return { error: null, success: true };
}
