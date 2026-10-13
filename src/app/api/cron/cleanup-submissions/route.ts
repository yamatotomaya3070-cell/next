/**
 * 確認が済んだ提出動画の自動削除（Vercel Cron から毎日1回）。
 * Supabase 無料プランの Storage 全体 1GB を超えないよう、保存期間を過ぎた動画だけを消す。
 * 動画を消す処理なので、CRON_SECRET が無いときは実行しない（誰でも叩ける状態にしない）。
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupExpiredSubmissions } from "@/lib/submissions/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredSubmissions(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("提出動画の自動削除に失敗しました:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
