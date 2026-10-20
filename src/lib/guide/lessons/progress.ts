/**
 * 教科書の進み具合（lesson_progress テーブル。migration 00021）の読み出しと、画面に出す形への変換。
 * テーブルがまだ無いときは available: false を返し、教科書はふつうに読めるままにする。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { LESSONS } from "./index";

export interface LessonProgress {
  /** テーブルが使えるか（migration 00021 が未適用なら false） */
  available: boolean;
  doneSlugs: string[];
}

export const LESSON_PROGRESS_MISSING_HINT =
  "進み具合を残す準備ができていません（migration 00021_lesson_progress.sql が未適用の可能性があります）。";

/** PostgREST の「テーブルが無い」エラーか */
export function isMissingTable(err: { code?: string } | null | undefined): boolean {
  return err?.code === "42P01" || err?.code === "PGRST205";
}

export async function loadLessonProgress(supabase: SupabaseClient, userId: string): Promise<LessonProgress> {
  const { data, error } = await supabase.from("lesson_progress").select("lesson_slug").eq("user_id", userId);
  if (error) {
    if (!isMissingTable(error)) console.error("教科書の進み具合の読み出しに失敗:", error);
    return { available: false, doneSlugs: [] };
  }
  return { available: true, doneSlugs: data.map((r) => r.lesson_slug as string) };
}

export interface ProgressSummary {
  done: number;
  total: number;
  /** 次にやるレッスン（全部終わっていれば null） */
  nextSlug: string | null;
}

/** 一本道なので、まだ終わっていない最初のレッスンが「次」 */
export function summarizeProgress(doneSlugs: readonly string[]): ProgressSummary {
  const done = new Set(doneSlugs);
  const next = LESSONS.find((l) => !done.has(l.slug)) ?? null;
  return { done: LESSONS.filter((l) => done.has(l.slug)).length, total: LESSONS.length, nextSlug: next?.slug ?? null };
}
