/**
 * 参考動画取り込みのクラウド自動解析（Vercel Cron の safety net）。
 * vercel.json の crons から定期的に叩かれ、pending の取り込みを Files API で解析する。
 * CRON_SECRET が設定されていれば Authorization: Bearer で検証する（Vercel Cron が自動付与）。
 */
import { NextResponse } from "next/server";
import { processPendingIngests } from "@/lib/video/analysis/ingestProcessor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processPendingIngests({ maxItems: 3, maxWaitMs: 200_000 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
