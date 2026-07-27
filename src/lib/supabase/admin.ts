import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * service role key を使う管理者クライアント。RLSを全てバイパスするため、
 * "use server" アクションからのみ、必要最小限の用途に限定して使うこと。
 * 絶対にクライアントコンポーネント／ブラウザに渡してはならない。
 *
 * 例: submitWork で video_jobs（職員のみRLS）の有無を確認し
 * submission_inspections（職員のみRLS）へ検品ジョブを登録する用途など、
 * 就労者のセッション権限では読み書きできない職員専用テーブルへの
 * システム側書き込みが必要な場合。
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です（.env.local を確認してください）",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
