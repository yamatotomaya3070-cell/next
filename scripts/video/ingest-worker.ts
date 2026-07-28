/**
 * 動画取り込み解析ワーカー（docs/00011 方式C）。
 *
 * video_ingests の pending を拾い、原本をStorageからDL → ffmpegで縮小(360p/最大120秒) →
 * Gemini動画理解で編集パターンを抽出 → editing_pattern に保存し status=analyzed にする。
 * ffmpeg/APIキーの使えるマシンで実行する（Vercelでは動かない）。
 *
 * 実行:
 *   npx tsx scripts/video/ingest-worker.ts            … pendingを全件処理
 *   npx tsx scripts/video/ingest-worker.ts --ingest <id>  … 単発処理
 *
 * 縮小はGeminiのinline上限(20MB未満)対策。長尺の実案件はFiles API化が今後の課題。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./env";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { run } from "./exec";
import { analyzeVideo } from "../../src/lib/video/analysis";

loadEnvLocal();

const WORKER_ID = `ingest-${process.pid}`;
const STALE_LOCK_MS = 10 * 60 * 1000;
const MAX_ANALYZE_SEC = 120; // 解析用に切り詰める最大秒数
const ANALYZE_HEIGHT = 360; // 縮小後の高さ

const SELECT = "id, title, genre_hint, source_kind, storage_path, status, retry_count, locked_at";

interface IngestRow {
  id: string;
  title: string;
  genre_hint: string | null;
  source_kind: string;
  storage_path: string;
  status: string;
  retry_count: number;
}

function workdirFor(id: string): string {
  return join("scripts", "output", "ingests", id);
}

/** pendingを1件クレーム（stale lockは奪取可） */
async function claimNext(): Promise<IngestRow | null> {
  const supabase = getSupabaseAdmin();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data: candidates, error } = await supabase
    .from("video_ingests")
    .select(`${SELECT}`)
    .in("status", ["pending", "analyzing"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`取り込み取得に失敗: ${error.message}`);

  for (const c of candidates ?? []) {
    const locked = (c as { locked_at: string | null }).locked_at;
    if (locked && locked > staleBefore) continue;
    const { data: claimed } = await supabase
      .from("video_ingests")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString(), status: "analyzing" })
      .eq("id", c.id)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select(SELECT)
      .maybeSingle();
    if (claimed) return claimed as IngestRow;
  }
  return null;
}

async function processIngest(ingest: IngestRow): Promise<void> {
  const supabase = getSupabaseAdmin();
  const workdir = workdirFor(ingest.id);
  mkdirSync(workdir, { recursive: true });

  try {
    // 1. 原本をStorageからDL
    const { data: blob, error: dlErr } = await supabase.storage
      .from("materials")
      .download(ingest.storage_path);
    if (dlErr || !blob) throw new Error(`原本DLに失敗: ${dlErr?.message ?? "空"}`);
    const srcPath = join(workdir, "source.mp4");
    writeFileSync(srcPath, Buffer.from(await blob.arrayBuffer()));

    // 2. 解析用に縮小(360p/最大120秒/低ビットレート)
    run(
      "ffmpeg",
      ["-y", "-t", String(MAX_ANALYZE_SEC), "-i", "source.mp4",
        "-vf", `scale=-2:${ANALYZE_HEIGHT}`, "-c:v", "libx264", "-crf", "30", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "64k", "small.mp4"],
      workdir,
    );

    // 3. Gemini動画理解で編集パターン抽出
    const base64 = readFileSync(join(workdir, "small.mp4")).toString("base64");
    const pattern = await analyzeVideo({
      videoBase64: base64,
      mimeType: "video/mp4",
      hint: ingest.genre_hint || ingest.title,
    });

    // 4. 保存
    const { provider, ...editingPattern } = pattern;
    const { error: upErr } = await supabase
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

    console.log(`取り込み ${ingest.id}（${ingest.title}）を解析しました: ${editingPattern.genre} / ${provider}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`取り込み ${ingest.id} の解析に失敗:`, message);
    await supabase
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
  }
}

async function main(): Promise<void> {
  const idArg = process.argv.includes("--ingest")
    ? process.argv[process.argv.indexOf("--ingest") + 1]
    : null;

  if (idArg) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("video_ingests")
      .update({ locked_by: WORKER_ID, locked_at: new Date().toISOString(), status: "analyzing" })
      .eq("id", idArg)
      .select(SELECT)
      .maybeSingle();
    if (error || !data) {
      console.error("指定の取り込みが見つかりません:", error?.message);
      process.exit(1);
    }
    await processIngest(data as IngestRow);
    return;
  }

  let processed = 0;
  for (;;) {
    const ingest = await claimNext();
    if (!ingest) break;
    processed += 1;
    await processIngest(ingest);
  }
  console.log(`完了。${processed}件処理しました。`);
}

main().catch((err) => {
  console.error("ワーカーが異常終了:", err instanceof Error ? err.message : err);
  process.exit(1);
});
