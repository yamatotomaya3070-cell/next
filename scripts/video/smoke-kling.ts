/**
 * Kling（fal.ai）で実際の動画クリップを1本生成する実機テスト。
 * 費用対効果の確認用。FAL_KEY が必要（.env.local）。
 *
 * 実行:
 *   npx tsx scripts/video/smoke-kling.ts ["英語プロンプト"] [秒数(5|10)]
 * 既定: 倉庫で在庫確認するスタッフ / 5秒 / 16:9。
 *
 * fal の Queue REST API を使う（submit → status ポーリング → 結果取得 → DL）。
 * モデルは FAL_KLING_MODEL で上書き可。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./env";

loadEnvLocal();

const QUEUE_BASE = "https://queue.fal.run";
const DEFAULT_MODEL = "fal-ai/kling-video/v2.6/pro/text-to-video";
const DEFAULT_PROMPT =
  "A warehouse worker in a uniform checking inventory on shelves with a tablet, realistic documentary style, natural lighting, handheld camera movement, 4k";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY が未設定です（.env.local を確認）");
  const model = process.env.FAL_KLING_MODEL || DEFAULT_MODEL;
  const prompt = process.argv[2] || DEFAULT_PROMPT;
  const duration = process.argv[3] || "5";

  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const outDir = join("scripts", "output", "kling-test");
  mkdirSync(outDir, { recursive: true });

  console.log(`モデル: ${model}`);
  console.log(`プロンプト: ${prompt}`);
  console.log(`長さ: ${duration}秒 / 16:9\n送信中…`);

  // 1. 送信
  const submit = await fetch(`${QUEUE_BASE}/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, duration, aspect_ratio: "16:9" }),
  });
  if (!submit.ok) {
    throw new Error(`送信に失敗 (${submit.status}): ${(await submit.text()).slice(0, 500)}`);
  }
  const submitData = (await submit.json()) as {
    request_id: string;
    status_url: string;
    response_url: string;
  };
  console.log(`request_id: ${submitData.request_id}\n生成待ち（Klingは数分かかります）…`);

  // 2. ポーリング
  const started = Date.now();
  let status = "IN_QUEUE";
  for (;;) {
    await sleep(6000);
    const st = await fetch(submitData.status_url, { headers });
    const stData = (await st.json()) as { status: string; queue_position?: number };
    if (stData.status !== status) {
      status = stData.status;
      console.log(`  [${Math.round((Date.now() - started) / 1000)}s] ${status}`);
    }
    if (status === "COMPLETED") break;
    if (Date.now() - started > 15 * 60 * 1000) throw new Error("タイムアウト（15分）");
  }

  // 3. 結果取得
  const res = await fetch(submitData.response_url, { headers });
  if (!res.ok) throw new Error(`結果取得に失敗 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const result = (await res.json()) as { video?: { url?: string } };
  const url = result.video?.url;
  if (!url) throw new Error(`動画URLが取得できませんでした: ${JSON.stringify(result).slice(0, 400)}`);
  console.log(`\n動画URL: ${url}`);

  // 4. ダウンロード
  const bin = await fetch(url);
  const buf = Buffer.from(await bin.arrayBuffer());
  const outPath = join(outDir, `kling_${submitData.request_id.slice(0, 8)}.mp4`);
  writeFileSync(outPath, buf);
  console.log(`保存しました: ${outPath}（${(buf.byteLength / 1024 / 1024).toFixed(2)} MB）`);
  console.log(`\n生成時間: ${Math.round((Date.now() - started) / 1000)}秒`);
  console.log("この動画を再生して、費用に対する品質を確認してください。");
}

main().catch((e) => {
  console.error("失敗:", e instanceof Error ? e.message : e);
  process.exit(1);
});
