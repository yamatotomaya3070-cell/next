"use server";

import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import { proposeStyleGuides } from "@/lib/ai";
import { normalizeStyleGuide, type StyleGuideContent } from "@/lib/style-guide/schema";
import type { StyleGuideRecord } from "@/lib/types";
import type { ActionState } from "./assignments";

const MAX_BRIEF_LENGTH = 2000;

export interface StyleGuideProposalState extends ActionState {
  proposals?: StyleGuideContent[];
  provider?: string;
  brief?: string;
  characterCount?: number;
}

/** 現在有効なスタイルガイドを取得（全生成工程が参照する。無ければ null） */
export async function getActiveStyleGuide(): Promise<StyleGuideRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("style_guides")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { ...(data as StyleGuideRecord), content: normalizeStyleGuide((data as StyleGuideRecord).content) };
}

/** スタイルガイド案をAIに複数提案させ、保存せずプレビューとして返す */
export async function proposeStyleGuidesAction(
  _prev: StyleGuideProposalState,
  formData: FormData,
): Promise<StyleGuideProposalState> {
  await requireRole("staff", "admin");

  const brief = String(formData.get("brief") ?? "").trim();
  const charCountRaw = String(formData.get("character_count") ?? "").trim();
  const characterCount = charCountRaw ? Number(charCountRaw) : 2;

  if (brief.length > MAX_BRIEF_LENGTH) {
    return { error: "方向性の説明が長すぎます（2000文字以内にしてください）。", brief };
  }
  if (!Number.isInteger(characterCount) || characterCount < 1 || characterCount > 4) {
    return { error: "キャラクター数は1〜4で指定してください。", brief };
  }

  try {
    const result = await proposeStyleGuides({ brief, characterCount, count: 3 });
    return {
      error: null,
      proposals: result.guides,
      provider: result.provider,
      brief,
      characterCount,
    };
  } catch (err) {
    console.error("スタイルガイド提案に失敗:", err);
    return { error: "提案の生成に失敗しました。少し時間をおいて再度お試しください。", brief };
  }
}

/**
 * 選択・編集したスタイルガイドを新バージョンとして保存し、有効化する。
 * content はフォームの hidden フィールドに JSON 文字列で入る（改ざん対策で必ず normalize）。
 * 有効化は「既存の is_active を全て false → 新規行を is_active=true で挿入」の順で行う
 * （style_guides の is_active 部分ユニークインデックスに合わせる）。
 */
export async function saveStyleGuide(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole("staff", "admin");
  const supabase = await createClient();

  const contentRaw = String(formData.get("content") ?? "");
  if (!contentRaw) return { error: "保存するスタイルガイドがありません。" };

  let content: StyleGuideContent;
  try {
    content = normalizeStyleGuide(JSON.parse(contentRaw));
  } catch {
    return { error: "スタイルガイドの形式が不正です。もう一度やり直してください。" };
  }

  // 次のバージョン番号を採番
  const { data: latest } = await supabase
    .from("style_guides")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((latest as { version?: number } | null)?.version ?? 0) + 1;

  // 既存の有効フラグを全て解除（部分ユニークインデックス対策）
  const { error: deactivateError } = await supabase
    .from("style_guides")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true);
  if (deactivateError) {
    return {
      error:
        "保存に失敗しました。style_guides テーブル（migration 00014）が未適用の可能性があります。",
    };
  }

  const { error: insertError } = await supabase.from("style_guides").insert({
    name: content.name,
    version: nextVersion,
    is_active: true,
    content,
    created_by: profile.id,
  });
  if (insertError) {
    console.error("スタイルガイド保存に失敗:", insertError);
    return { error: "スタイルガイドの保存に失敗しました。" };
  }

  revalidatePath("/staff/style-guide");
  return { error: null, success: true };
}
