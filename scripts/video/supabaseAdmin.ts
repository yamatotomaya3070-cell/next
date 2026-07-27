/**
 * ワーカー専用のSupabaseクライアント（service role key を使用）。
 *
 * video_jobs は職員のみRLSで保護されているが、ワーカーはログインユーザーの
 * セッションを持たないローカルプロセスのため、service role key でRLSを
 * バイパスして読み書きする。このキーは絶対にクライアント（ブラウザ）へ
 * 露出させてはならず、この worker.ts / このファイルからのみ使用すること。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です（.env.local を確認してください）",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
