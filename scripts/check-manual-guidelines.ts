/**
 * manual_guidelines（手順の学習ルール）が適用済みか・何件入っているかを確認する。
 * 実行: npx tsx scripts/check-manual-guidelines.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./video/env";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main(): Promise<void> {
  if (!url || !key) {
    throw new Error(`env不足: URL=${Boolean(url)} SERVICE_ROLE_KEY=${Boolean(key)}`);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data, error, count } = await sb
    .from("manual_guidelines")
    .select("title, reason, is_active, skill_tags, source_task_id, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (error) {
    console.log(`❌ 未適用または取得失敗: ${error.message}`);
    console.log("→ Supabase に 00019_manual_guidelines.sql を適用してください。");
    return;
  }

  console.log(`✅ manual_guidelines 適用済み / 全 ${count ?? 0} 件`);
  for (const g of data ?? []) {
    console.log(
      `- [${g.is_active ? "有効" : "無効"}] ${g.title}  (skill:${(g.skill_tags ?? []).join(",") || "全案件"} / source:${g.source_task_id ? "案件あり" : "直接登録/seed"} / ${g.created_at})`,
    );
  }
}

main().catch((err) => {
  console.error("確認に失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
