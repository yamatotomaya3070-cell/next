"use server";

import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveStyleGuide } from "./styleGuide";
import { generatePracticeScript } from "@/lib/ai";
import { resolveDifficultyTier, type DifficultyTier } from "@/lib/practice-script/difficulty";
import { buildPracticeCasePackage, type PracticeCasePackage } from "@/lib/practice-script/package";
import {
  normalizePracticeScript,
  validatePracticeScriptBalance,
  type GeneratedPracticeScript,
} from "@/lib/practice-script/schema";
import type { ActionState } from "./assignments";

const MAX_THEME_LENGTH = 200;
const MIN_TARGET_MINUTES = 1;
const MAX_TARGET_MINUTES = 20;
const DEFAULT_TARGET_MINUTES = 10;

export interface PracticeCasePreviewState extends ActionState {
  casePackage?: PracticeCasePackage;
  script?: GeneratedPracticeScript; // ジョブ登録に持ち回す（プレビューと同一の台本で素材を作るため）
  provider?: string;
  warnings?: string[];
  theme?: string;
  tier?: DifficultyTier;
  targetMinutes?: number;
}

/**
 * 練習素材ジェネレーター（Stage2〜4の統合プレビュー）。
 * テーマ＋難易度から、配布用の素材台本・依頼書・作業指示書・正解データ一式を生成して返す。
 * まだ保存はしない（プレビュー）。実際の素材mp4のレンダリングは動画パイプラインの役割。
 */
export async function previewPracticeCaseAction(
  _prev: PracticeCasePreviewState,
  formData: FormData,
): Promise<PracticeCasePreviewState> {
  await requireRole("staff", "admin");

  const theme = String(formData.get("theme") ?? "").trim();
  const profile = resolveDifficultyTier(formData.get("difficulty"));
  const rawMinutes = Number(formData.get("target_minutes"));
  const targetMinutes =
    Number.isFinite(rawMinutes) && rawMinutes >= MIN_TARGET_MINUTES && rawMinutes <= MAX_TARGET_MINUTES
      ? Math.round(rawMinutes)
      : DEFAULT_TARGET_MINUTES;

  if (!theme) return { error: "動画のテーマを入力してください。", tier: profile.tier, targetMinutes };
  if (theme.length > MAX_THEME_LENGTH) {
    return { error: "テーマが長すぎます（200文字以内）。", theme, tier: profile.tier, targetMinutes };
  }

  const guide = await getActiveStyleGuide();
  if (!guide) {
    return {
      error: "有効なスタイルガイドがありません。先にスタイルガイドを確定してください。",
      theme,
      tier: profile.tier,
      targetMinutes,
    };
  }

  try {
    const script = await generatePracticeScript({
      styleGuide: guide.content,
      theme,
      difficulty: profile.scriptDifficulty,
      targetKeepMinutes: targetMinutes,
    });
    const casePackage = buildPracticeCasePackage(script, profile, guide.content);
    const warnings = validatePracticeScriptBalance(script);
    return {
      error: null,
      casePackage,
      script,
      provider: script.provider,
      warnings,
      theme,
      tier: profile.tier,
      targetMinutes,
    };
  } catch (err) {
    console.error("練習素材の生成に失敗:", err);
    return {
      error: "生成に失敗しました。少し時間をおいて再度お試しください。",
      theme,
      tier: profile.tier,
      targetMinutes,
    };
  }
}

/** practice_jobs の1行（一覧表示・ダウンロードに使う） */
export interface PracticeJobRecord {
  id: string;
  theme: string;
  difficulty: DifficultyTier;
  target_seconds: number;
  status: string;
  progress: number;
  provider: string | null;
  artifacts: { sample_video?: string; assets_zip?: string } | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * プレビュー内容をそのままレンダリングジョブとして登録する（保存）。
 * ffmpegワーカー(practice-worker.ts)が拾って素材mp4一式を書き出す。
 * プレビューと同一の台本で作るため、台本JSONを hidden で受け取り再正規化して保存する。
 */
export async function createPracticeJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole("staff", "admin");

  const scriptRaw = String(formData.get("script") ?? "");
  if (!scriptRaw) return { error: "登録する台本がありません。もう一度プレビューしてください。" };
  const profileTier = resolveDifficultyTier(formData.get("difficulty"));
  const rawMinutes = Number(formData.get("target_minutes"));
  const targetSeconds =
    Number.isFinite(rawMinutes) && rawMinutes >= 1 && rawMinutes <= 20
      ? Math.round(rawMinutes) * 60
      : 600;

  const guide = await getActiveStyleGuide();
  if (!guide) return { error: "有効なスタイルガイドがありません。" };

  let script: GeneratedPracticeScript;
  try {
    script = normalizePracticeScript(JSON.parse(scriptRaw), guide.content, targetSeconds);
  } catch {
    return { error: "台本の形式が不正です。もう一度やり直してください。" };
  }

  const casePackage = buildPracticeCasePackage(script, profileTier, guide.content);
  const supabase = await createClient();
  const { error } = await supabase.from("practice_jobs").insert({
    style_guide_id: guide.id,
    theme: script.episodeTitle || script.title,
    difficulty: profileTier.tier,
    target_seconds: targetSeconds,
    script,
    style_guide: guide.content,
    answer_data: casePackage.answerData,
    status: "pending",
    created_by: profile.id,
  });
  if (error) {
    console.error("練習ジョブの登録に失敗:", error);
    return {
      error:
        "登録に失敗しました。practice_jobs テーブル（migration 00016）が未適用の可能性があります。",
    };
  }

  revalidatePath("/staff/practice");
  return { error: null, success: true };
}

/** 登録済みの練習ジョブ一覧（職員のRLS scoped client） */
export async function getPracticeJobs(): Promise<PracticeJobRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_jobs")
    .select(
      "id, theme, difficulty, target_seconds, status, progress, provider, artifacts, error, created_at, completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as PracticeJobRecord[] | null) ?? [];
}

/** 完成ジョブの成果物（完成見本・素材ZIP）の署名付きURLを発行する */
export async function getPracticeJobArtifactUrls(
  job: PracticeJobRecord,
): Promise<{ sampleUrl?: string; zipUrl?: string }> {
  if (!job.artifacts) return {};
  const admin = createAdminClient();
  const result: { sampleUrl?: string; zipUrl?: string } = {};
  if (job.artifacts.sample_video) {
    const { data } = await admin.storage
      .from("materials")
      .createSignedUrl(job.artifacts.sample_video, 60 * 60);
    if (data?.signedUrl) result.sampleUrl = data.signedUrl;
  }
  if (job.artifacts.assets_zip) {
    const { data } = await admin.storage
      .from("materials")
      .createSignedUrl(job.artifacts.assets_zip, 60 * 60);
    if (data?.signedUrl) result.zipUrl = data.signedUrl;
  }
  return result;
}
