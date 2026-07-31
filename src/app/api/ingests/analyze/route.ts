/**
 * 参考動画取り込みの手動解析（職員の「今すぐ解析」ボタン）。
 * 職員/管理者セッションを検証し、指定IDの取り込みを Files API で即時解析する。
 * requireRole は redirect を投げAPI用途に不向きなため、ここでは直接セッションを検証してJSONを返す。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processIngestById } from "@/lib/video/analysis/ingestProcessor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "ログインが必要です。" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "権限がありません。" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id が必要です。" }, { status: 400 });
  }

  const result = await processIngestById(id, { maxWaitMs: 200_000 });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
