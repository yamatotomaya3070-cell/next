/**
 * 本番Supabaseに各マイグレーションのテーブル/列が適用済みかを実際に確認する。
 * 実行: npx tsx scripts/check-tables.ts
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

  const checks: Array<{ label: string; table: string; column?: string }> = [
    { label: "00006 video_jobs", table: "video_jobs" },
    { label: "00007 video_jobs.template_type", table: "video_jobs", column: "template_type" },
    { label: "00008 submission_inspections", table: "submission_inspections" },
    { label: "00009 ai_usage_logs", table: "ai_usage_logs" },
    { label: "00010 production_transfer_approvals", table: "production_transfer_approvals" },
    { label: "00005 case_knowledge", table: "case_knowledge" },
    { label: "00004 material_answers", table: "material_answers" },
    { label: "00003 case_documents (RAG)", table: "case_documents" },
    { label: "00003 curriculum_stages", table: "curriculum_stages" },
  ];

  for (const c of checks) {
    const { error } = await sb.from(c.table).select(c.column ?? "*", { count: "exact", head: true });
    console.log(`${error ? "❌ 未適用" : "✅ 適用済"}  ${c.label}${error ? `  (${error.message})` : ""}`);
  }
}

main().catch((err) => {
  console.error("確認に失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
