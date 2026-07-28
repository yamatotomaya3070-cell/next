/**
 * アプリの createVideoJob と同一の video_jobs 行を登録する（実機通しテスト用）。
 * 実行: npx tsx scripts/insert-test-job.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./video/env";

loadEnvLocal();

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabaseのenvが不足しています");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from("video_jobs")
    .insert({
      theme: "在庫管理の基本",
      difficulty: 2,
      target_duration_sec: 60,
      template_type: "business_explainer",
      use_broll: true,
      broll_keywords: [
        "warehouse inventory management",
        "logistics workers scanning",
        "modern office team meeting",
      ],
      status: "pending",
      created_by: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  console.log("JOB_ID=" + data.id);
}

main().catch((err) => {
  console.error("登録失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
