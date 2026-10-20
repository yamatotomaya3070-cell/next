"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { getLesson } from "@/lib/guide/lessons";
import { LESSON_PROGRESS_MISSING_HINT, isMissingTable } from "@/lib/guide/lessons/progress";

export interface SetLessonDoneResult {
  error: string | null;
}

/** 利用者が、レッスンの「できた」を付ける・取り消す */
export async function setLessonDone(slug: string, done: boolean): Promise<SetLessonDoneResult> {
  const profile = await requireProfile();
  if (profile.role !== "trainee") return { error: "進み具合は利用者の方だけが記録できます。" };
  if (!getLesson(slug)) return { error: "そのレッスンは見つかりません。" };

  const supabase = await createClient();
  const { error } = done
    ? await supabase.from("lesson_progress").upsert({ user_id: profile.id, lesson_slug: slug }, { onConflict: "user_id,lesson_slug" })
    : await supabase.from("lesson_progress").delete().eq("user_id", profile.id).eq("lesson_slug", slug);

  if (error) {
    console.error("教科書の進み具合の記録に失敗:", error);
    return { error: isMissingTable(error) ? LESSON_PROGRESS_MISSING_HINT : "記録できませんでした。時間をおいて、もう一度押してください。" };
  }
  revalidatePath("/guide");
  revalidatePath(`/guide/${slug}`);
  return { error: null };
}
