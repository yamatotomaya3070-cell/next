"use server";

import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import {
  isTemplateImplemented,
  validateTemplateScript,
  VIDEO_TEMPLATE_TYPES,
  type VideoTemplateType,
} from "@/lib/video/templates";
import type { ActionState } from "./assignments";

/**
 * このアクションはジョブの「登録」のみ行う（DBへの pending 行の作成）。
 * 実際の生成処理（台本→音声→字幕→レンダリング→パッケージ→案件登録）は
 * scripts/video/worker.ts が ffmpeg/TTS の使えるマシンで別途実行する。
 * 管理画面はポーリング表示のみで、生成そのものはこのNext.jsサーバーでは行わない
 * （Vercel等のサーバーレス環境には ffmpeg/Windows TTS が存在しないため）。
 */
export async function createVideoJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const theme = String(formData.get("theme") ?? "").trim();
  const difficulty = Number(formData.get("difficulty") ?? 1);
  const targetDurationSec = Number(formData.get("target_duration_sec") ?? 60);
  const sourceCaseId = String(formData.get("source_case_id") ?? "").trim();
  const rawCaseContext = String(formData.get("case_context") ?? "").trim();
  // ジャンル選択は廃止。実写寄りの1本立て（business_explainer）に固定する。
  // フォームは hidden で template_type を渡すが、未指定でも既定にフォールバックする。
  const requested = String(formData.get("template_type") ?? "") as VideoTemplateType;
  const templateType: VideoTemplateType =
    VIDEO_TEMPLATE_TYPES.includes(requested) && isTemplateImplemented(requested)
      ? requested
      : "business_explainer";
  // 実写Bロールは既定でオン（英語キーワードUIは廃止。キーワードはテーマから裏で導出する）。
  const useBroll = formData.get("use_broll") === "off" ? false : true;
  const brollKeywords: string[] = [];
  let caseContext = rawCaseContext ? `職員が入力した実案件メモ:\n${rawCaseContext}` : "";

  if (sourceCaseId) {
    const { data: sourceCase, error: sourceCaseError } = await supabase
      .from("case_knowledge")
      .select("id, title, genre, skill_tags, difficulty, caution_points, masked_case_text")
      .eq("id", sourceCaseId)
      .maybeSingle();
    if (sourceCaseError) {
      return { error: "参照する実案件の取得に失敗しました。" };
    }
    if (!sourceCase) {
      return { error: "参照する実案件が見つかりません。" };
    }
    caseContext = [
      `保存済み実案件: ${sourceCase.title}`,
      sourceCase.genre ? `ジャンル: ${sourceCase.genre}` : null,
      Array.isArray(sourceCase.skill_tags) && sourceCase.skill_tags.length > 0
        ? `必要スキル: ${sourceCase.skill_tags.join(", ")}`
        : null,
      sourceCase.difficulty ? `実案件から見た難易度: ${sourceCase.difficulty}` : null,
      Array.isArray(sourceCase.caution_points) && sourceCase.caution_points.length > 0
        ? `注意点:\n${sourceCase.caution_points.map((p) => `- ${p}`).join("\n")}`
        : null,
      `匿名化済み案件文:\n${sourceCase.masked_case_text}`,
      rawCaseContext ? `追加メモ:\n${rawCaseContext}` : null,
    ].filter(Boolean).join("\n\n");
  }

  if (!theme) return { error: "案件のテーマを入力してください。" };
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) {
    return { error: "難易度は1〜3で指定してください。" };
  }
  if (!Number.isFinite(targetDurationSec) || targetDurationSec < 15 || targetDurationSec > 300) {
    return { error: "目標動画時間は15〜300秒で指定してください。" };
  }

  const { error } = await supabase.from("video_jobs").insert({
    theme,
    difficulty,
    target_duration_sec: Math.round(targetDurationSec),
    template_type: templateType,
    use_broll: useBroll,
    broll_keywords: brollKeywords,
    source_case_id: sourceCaseId || null,
    case_context: caseContext || null,
    status: "pending",
    created_by: staff.id,
  });
  if (error) {
    return {
      error:
        "登録に失敗しました。video_jobs テーブル（migration 00006/00007/00011）が適用済みか確認してください。",
    };
  }

  revalidatePath("/staff/video-jobs");
  return { error: null, success: true };
}

/** 失敗ジョブを再開する（失敗工程から。workdirのキャッシュを再利用する） */
export async function retryVideoJob(jobId: string): Promise<ActionState> {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("video_jobs")
    .select("status, error_stage")
    .eq("id", jobId)
    .single();
  if (!job || job.status !== "failed") {
    return { error: "失敗しているジョブのみ再実行できます。" };
  }

  const { error } = await supabase
    .from("video_jobs")
    .update({
      status: job.error_stage ?? "pending",
      error: null,
      locked_by: null,
      locked_at: null,
    })
    .eq("id", jobId);
  if (error) return { error: "再実行の登録に失敗しました。" };

  revalidatePath("/staff/video-jobs");
  return {
    error: null,
    success: true,
  };
}

/** 台本を編集して保存する（次回のワーカー実行時にこの台本が使われる） */
export async function updateVideoJobScript(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const jobId = String(formData.get("job_id") ?? "");
  const scriptJson = String(formData.get("script_json") ?? "");
  if (!jobId) return { error: "対象のジョブが見つかりません。" };

  const { data: job } = await supabase
    .from("video_jobs")
    .select("status, template_type")
    .eq("id", jobId)
    .single();
  if (!job || job.status === "completed") {
    return { error: "完了済みのジョブは編集できません。" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(scriptJson);
  } catch {
    return { error: "台本が有効なJSONではありません。" };
  }
  const result = validateTemplateScript(job.template_type as VideoTemplateType, parsed);
  if (!result.ok || !result.script) {
    return { error: `台本の検証に失敗しました: ${result.errors.join(" / ")}` };
  }

  const { error } = await supabase
    .from("video_jobs")
    .update({
      script: result.script,
      status: "generating_script",
      error: null,
      error_stage: null,
      locked_by: null,
      locked_at: null,
    })
    .eq("id", jobId);
  if (error) return { error: "台本の保存に失敗しました。" };

  revalidatePath("/staff/video-jobs");
  return { error: null, success: true };
}
