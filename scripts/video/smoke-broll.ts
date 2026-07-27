/**
 * Bロール背景ビルダーのスモークテスト（マイルストーン2の中核検証）。
 *
 * 実行:  npx tsx scripts/video/smoke-broll.ts
 * 前提:  .env.local に PEXELS_API_KEY、ffmpeg/ffprobe が PATH にあること。
 *
 * 検証内容:
 *   1. 複数キーワードでのストック検索→DL→WxH cover正規化→連結
 *   2. 出力背景動画が 1920x1080・目標尺以上・映像トラックありであること
 *   3. 使用クリップのクレジットが返ること
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvLocal } from "./env";
import { buildBrollBackground } from "./broll";
import { creditLine } from "../../src/lib/video/stock";

loadEnvLocal();

function probe(file: string): { width: number; height: number; durationSec: number; hasVideo: boolean } {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries",
      "stream=width,height:format=duration", "-of", "json", file],
    { encoding: "utf8" },
  );
  const p = JSON.parse(out) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
  const s = p.streams?.[0];
  return { width: s?.width ?? 0, height: s?.height ?? 0, durationSec: Number(p.format?.duration ?? 0), hasVideo: Boolean(s) };
}

async function main(): Promise<void> {
  const width = 1920;
  const height = 1080;
  const targetSec = 15;
  const workdir = join(tmpdir(), "broll-smoke");
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(workdir, { recursive: true });
  const outPath = join(workdir, "broll_background.mp4");

  const result = await buildBrollBackground({
    keywords: ["business meeting office", "typing laptop closeup", "modern office interior"],
    totalDurationSec: targetSec,
    width, height,
    orientation: "landscape",
    outPath,
    tmpDir: join(workdir, "tmp"),
  });

  console.log(`使用クリップ数: ${result.credits.length}`);
  for (const c of result.credits) console.log(`  - ${creditLine(c)}`);

  const info = probe(outPath);
  const bytes = statSync(outPath).size;
  const ok = info.hasVideo && info.width === width && info.height === height && info.durationSec >= targetSec - 1;
  console.log(
    `\n${ok ? "✅" : "❌"} ${outPath}  ${(bytes / 1024 / 1024).toFixed(1)}MB  ` +
      `${info.width}x${info.height} ${info.durationSec.toFixed(1)}s（目標${targetSec}s）`,
  );
  if (!ok) throw new Error("Bロール背景の検証に失敗しました");
  console.log("\n✅ Bロール背景ビルダー スモークテスト合格");
}

main().catch((err) => {
  console.error("❌ 失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
