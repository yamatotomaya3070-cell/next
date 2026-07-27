/**
 * Pexels ストック動画クライアントのスモークテスト（マイルストーン2の実機検証）。
 *
 * 実行:  npx tsx scripts/video/smoke-pexels.ts ["検索語"]
 * 前提:  .env.local に PEXELS_API_KEY、ffprobe が PATH にあること。
 *
 * 検証内容:
 *   1. Pexels 検索APIの疎通（Authorizationヘッダ）
 *   2. クリップのメタデータ（尺・解像度・撮影者クレジット）取得
 *   3. 目標解像度に近いレンディション選択（pickVideoFile）
 *   4. 実ダウンロード → ffprobe で再生可能なmp4であることを確認
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvLocal } from "./env";
import { downloadStockFile } from "./stock";
import { getStockProvider, pickVideoFile, creditLine } from "../../src/lib/video/stock";

loadEnvLocal();

interface ProbeResult {
  hasVideo: boolean;
  width: number;
  height: number;
  durationSec: number;
}

function probeVideo(file: string): ProbeResult {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries",
      "stream=width,height:format=duration", "-of", "json", file],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const s = parsed.streams?.[0];
  return {
    hasVideo: Boolean(s),
    width: s?.width ?? 0,
    height: s?.height ?? 0,
    durationSec: Number(parsed.format?.duration ?? 0),
  };
}

async function main(): Promise<void> {
  const query = process.argv[2] ?? "home office working laptop";
  const provider = getStockProvider();
  console.log(`provider: ${provider.name} / query: "${query}"`);

  const clips = await provider.searchVideos(query, {
    orientation: "landscape",
    perPage: 8,
    minDurationSec: 5,
  });
  console.log(`取得クリップ数: ${clips.length}`);
  if (clips.length === 0) throw new Error("クリップが0件でした（検索語を変えて再試行）");

  for (const c of clips.slice(0, 3)) {
    console.log(`  - #${c.id} ${c.width}x${c.height} ${c.durationSec}s  by ${creditLine(c)}`);
  }

  // 先頭クリップを 1920x1080 想定でダウンロード検証
  const target = clips[0];
  const file = pickVideoFile(target, 1920, 1080);
  if (!file) throw new Error("mp4レンディションが見つかりませんでした");
  console.log(`\n選択レンディション: ${file.quality} ${file.width}x${file.height} ${file.fileType}`);

  const workdir = join(tmpdir(), "pexels-smoke");
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(workdir, { recursive: true });
  const dest = join(workdir, `clip_${target.id}.mp4`);

  console.log("ダウンロード中...");
  await downloadStockFile(file.link, dest);
  const bytes = statSync(dest).size;
  const probe = probeVideo(dest);

  const ok = probe.hasVideo && probe.width > 0 && probe.height > 0 && probe.durationSec > 0 && bytes > 0;
  console.log(
    `${ok ? "✅" : "❌"} ${dest}  ${(bytes / 1024 / 1024).toFixed(1)}MB  ` +
      `${probe.width}x${probe.height} ${probe.durationSec.toFixed(1)}s`,
  );
  if (!ok) throw new Error("ダウンロードしたクリップの検証に失敗しました");

  console.log("\n✅ Pexels スモークテスト合格（検索・メタ取得・レンディション選択・DL・再生検証）");
}

main().catch((err) => {
  console.error("❌ 失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
