/**
 * 参考動画取り込みのクラウド解析（docs/00011 方式C・A案: Vercel Cron + Files API）。
 *
 * ffmpeg 不要の Files API 経路（analyzeVideoBytes）を使い、Storage の原本をDL → 解析 →
 * editing_pattern を保存する。常駐ワーカー機（scripts/video/ingest-worker.ts）を置き換える。
 *
 * - Cron ルート（/api/cron/process-ingests）: pending をバッチ処理（safety net）
 * - 手動ルート（/api/ingests/analyze）: 職員が「今すぐ解析」で単発実行
 *
 * service role の admin クライアントで職員限定RLSの video_ingests / materials に触れる。
 * サーバー専用（"server-only"）。
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeVideoBytes } from "./index";

const INGEST_BUCKET = "materials";
const STALE_LOCK_MS = 10 * 60 * 1000; // これより古いロックは奪取可
const WORKER_ID = "vercel-cloud";
const DEFAULT_MAX_ITEMS = 3; // 1回のCron実行で処理する最大件数（実行時間予算のため）

const SELECT = "id, title, genre_hint, storage_path, status, retry_count, locked_at";

interface IngestRow {
  id: string;
  title: string;
  genre_hint: string | null;
  storage_path: string;
  status: string;
  retry_count: number;
}

export interface IngestResult {
  ok: boolean;
  id: string;
  provider?: string;
  message: string;
}

export interface ProcessOptions {
  maxItems?: number;
  maxWaitMs?: number;
}

/** 拡張子から mime type を推定する（既定は video/mp4） */
function guessMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    default:
      return "video/mp4";
  }
}

/** pending/analyzing を1件クレームする（stale lock は奪取可） */
async function claimNext(admin: SupabaseClient): Promise<IngestRow | null> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data: candidates, error } = await admin
    .from("video_ingests")
    .select(SELECT)
    .in("status", ["pending", "analyzing"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`取り込み取得に失敗: ${error.message}`);

  const rows = (candidates ?? []) as unknown as Array<IngestRow & { locked_at: string | null }>;
  for (const c of rows) {
    if (c.locked_at && c.locked_at > staleBefore) continue;
    const { data: claimed } = await admin
      .from("video_ingests")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString(), status: "analyzing" })
      .eq("id", c.id)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select(SELECT)
      .maybeSingle();
    if (claimed) return claimed as unknown as IngestRow;
  }
  return null;
}

/** クレーム済みの1件を解析して結果を保存する */
async function processRow(
  admin: SupabaseClient,
  ingest: IngestRow,
  opts: ProcessOptions,
): Promise<IngestResult> {
  try {
    const { data: blob, error: dlErr } = await admin.storage
      .from(INGEST_BUCKET)
      .download(ingest.storage_path);
    if (dlErr || !blob) throw new Error(`原本DLに失敗: ${dlErr?.message ?? "空"}`);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const pattern = await analyzeVideoBytes({
      bytes,
      mimeType: guessMimeType(ingest.storage_path),
      hint: ingest.genre_hint || ingest.title,
      displayName: ingest.title,
      maxWaitMs: opts.maxWaitMs,
    });

    const { provider, ...editingPattern } = pattern;
    const { error: upErr } = await admin
      .from("video_ingests")
      .update({
        editing_pattern: editingPattern,
        provider,
        status: "analyzed",
        error: null,
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ingest.id);
    if (upErr) throw new Error(`解析結果の保存に失敗: ${upErr.message}`);

    return { ok: true, id: ingest.id, provider, message: `解析しました: ${editingPattern.genre}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("video_ingests")
      .update({
        status: "failed",
        error: message,
        retry_count: ingest.retry_count + 1,
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ingest.id);
    return { ok: false, id: ingest.id, message };
  }
}

/** pending を最大 maxItems 件まで処理する（Cron のバッチ経路） */
export async function processPendingIngests(
  opts: ProcessOptions = {},
): Promise<{ processed: number; results: IngestResult[] }> {
  const admin = createAdminClient();
  const maxItems = opts.maxItems ?? DEFAULT_MAX_ITEMS;
  const results: IngestResult[] = [];
  for (let i = 0; i < maxItems; i += 1) {
    const ingest = await claimNext(admin);
    if (!ingest) break;
    results.push(await processRow(admin, ingest, opts));
  }
  return { processed: results.length, results };
}

/** ID指定で1件を強制解析する（職員の「今すぐ解析」経路） */
export async function processIngestById(
  id: string,
  opts: ProcessOptions = {},
): Promise<IngestResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("video_ingests")
    .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString(), status: "analyzing" })
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, id, message: "対象の取り込みが見つかりませんでした。" };
  }
  return processRow(admin, data as unknown as IngestRow, opts);
}
