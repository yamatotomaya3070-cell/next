"use server";

import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 案件（タスク）を削除する。素材・割当・提出・レビューは FK の ON DELETE CASCADE で
 * 一緒に消える。ストレージ上の完成見本・支給素材ZIPも併せて削除する（best-effort）。
 * scene_jobs.task_id は ON DELETE SET NULL なのでジョブ履歴は残る（案件リンクが外れる）。
 */
export async function deleteTask(formData: FormData): Promise<void> {
  await requireRole("staff", "admin");
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!taskId) return;

  const supabase = await createClient();

  // ストレージのファイル（materials バケット）を先に消す
  const { data: mats } = await supabase
    .from("task_materials")
    .select("media_url")
    .eq("task_id", taskId)
    .not("media_url", "is", null);
  const paths = (mats ?? [])
    .map((m) => m.media_url as string | null)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    try {
      const admin = createAdminClient();
      await admin.storage.from("materials").remove(paths);
    } catch {
      // ストレージ削除の失敗は致命的ではない（DB削除は続行）
    }
  }

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) {
    throw new Error(`案件の削除に失敗しました：${error.message}`);
  }

  revalidatePath("/staff/tasks");
}
