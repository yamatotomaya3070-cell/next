// ワーカーPCの準備がそろっているかを確かめる（セットアップの最後と、困ったときに実行する）。
//   使い方: npx tsx scripts/scene/checkWorkerSetup.ts
// 何が足りないかを ○× で出し、1つでも × があれば終了コード 1 にする。
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// worker.ts と同じ読み方で .env.local を読む
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const MIN_NODE_MAJOR = 20;
// poc/infographic/conversation.mjs が読み込む立ち絵（無いと会話場面の描画が始まらない）
const CHAR_DIR = "poc/character/out/cutout/reel";
const CHAR_FILES = [
  ...["neutral", "curious", "surprised", "worried", "thinking", "understood", "happy"].map((e) => `haru_${e}.png`),
  ...["neutral", "explaining", "pointing", "caution", "reassuring", "thinking", "positive"].map((e) => `mina_${e}.png`),
];
// poc/scene/render_project.mjs / build_materials.mjs が使う共通素材
const ASSET_FILES = ["assets/video/opening.mp4", "assets/video/ending.mp4", "assets/video/bgm_classroom_body.wav"];
const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"];
const FETCH_TIMEOUT_MS = 15000;

interface Check {
  label: string;
  ok: boolean;
  hint?: string;
}

const commandWorks = (cmd: string): boolean => spawnSync(cmd, ["-version"], { encoding: "utf8" }).status === 0;

async function httpOk(url: string, headers: Record<string, string> = {}): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function run(): Promise<Check[]> {
  const checks: Check[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    label: `Node.js ${process.versions.node}`,
    ok: nodeMajor >= MIN_NODE_MAJOR,
    hint: `Node.js ${MIN_NODE_MAJOR} 以上が必要です`,
  });
  for (const cmd of ["ffmpeg", "ffprobe"]) {
    checks.push({ label: cmd, ok: commandWorks(cmd), hint: `${cmd} が見つかりません。ffmpeg を入れて、パソコンを再起動してください` });
  }
  try {
    await import("sharp");
    checks.push({ label: "画像処理（sharp）", ok: true });
  } catch (e) {
    checks.push({ label: "画像処理（sharp）", ok: false, hint: `npm install をやり直してください（${e instanceof Error ? e.message : e}）` });
  }

  const missingChars = CHAR_FILES.filter((f) => !existsSync(`${CHAR_DIR}/${f}`));
  checks.push({
    label: `立ち絵 ${CHAR_FILES.length}枚（${CHAR_DIR}）`,
    ok: missingChars.length === 0,
    hint: `足りない: ${missingChars.join(", ")}`,
  });
  const missingAssets = ASSET_FILES.filter((f) => !existsSync(f));
  checks.push({ label: "オープニング・エンディング・BGM（assets/video）", ok: missingAssets.length === 0, hint: `足りない: ${missingAssets.join(", ")}` });

  const missingEnv = ENV_KEYS.filter((k) => !process.env[k]);
  checks.push({ label: "設定ファイル .env.local の3項目", ok: missingEnv.length === 0, hint: `足りない: ${missingEnv.join(", ")}` });

  if (missingEnv.length === 0) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sb = await httpOk(`${url}/rest/v1/scene_jobs?select=id&limit=1`, { apikey: key, Authorization: `Bearer ${key}` });
    checks.push({ label: "Supabase への接続（scene_jobs を読める）", ok: sb.ok, hint: `${sb.detail}。URL と service role key を確かめてください` });
    const gem = await httpOk(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${process.env.GEMINI_API_KEY}`);
    checks.push({ label: "Gemini API キー", ok: gem.ok, hint: `${gem.detail}。GEMINI_API_KEY を確かめてください` });
  }
  return checks;
}

// tsx（cjs 出力）ではトップレベル await が使えないので main() にまとめる
async function main() {
  const checks = await run();
  console.log("\n=== ワーカーの準備 ===");
  for (const c of checks) {
    console.log(`  ${c.ok ? "○" : "×"} ${c.label}${c.ok || !c.hint ? "" : `\n      → ${c.hint}`}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed === 0 ? "\n準備はそろっています。" : `\n× が ${failed} 件あります。直してから、もう一度実行してください。`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
