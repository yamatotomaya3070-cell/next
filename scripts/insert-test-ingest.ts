/**
 * 取り込み解析ワーカーの検証用: ローカル動画をStorageへアップロードし video_ingests 行を登録する。
 * （アプリの createVideoIngest アクションが行う処理と同じ = service roleでmaterialsへ格納）
 *
 * 実行: npx tsx scripts/insert-test-ingest.ts <ローカル動画パス> ["タイトル"] ["ジャンルヒント"]
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { getSupabaseAdmin } from "./video/supabaseAdmin";
import { loadEnvLocal } from "./video/env";

loadEnvLocal();

async function main(): Promise<void> {
  const videoPath = process.argv[2];
  if (!videoPath) throw new Error("ローカル動画パスを指定してください");
  const title = process.argv[3] ?? "参考動画テスト";
  const genreHint = process.argv[4] ?? "ビジネス解説";

  const supabase = getSupabaseAdmin();
  const id = randomUUID();
  const storagePath = `ingests/${id}/source.mp4`;

  const { error: upErr } = await supabase.storage
    .from("materials")
    .upload(storagePath, readFileSync(videoPath), { contentType: "video/mp4", upsert: true });
  if (upErr) throw new Error(`アップロード失敗: ${upErr.message}`);

  const { data, error } = await supabase
    .from("video_ingests")
    .insert({
      id,
      title,
      genre_hint: genreHint,
      source_kind: "reference",
      storage_path: storagePath,
      consent_status: "approved",
      status: "pending",
      created_by: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`登録失敗: ${error.message}`);

  console.log("INGEST_ID=" + data.id);
  console.log("storage=" + storagePath);
}

main().catch((err) => {
  console.error("失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
