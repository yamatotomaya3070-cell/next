/**
 * テーマ → VideoProject(JSON) を生成して保存する CLI（src/lib/scene/generate.ts のラッパー）。
 *   使い方: npx tsx scripts/gen-scene-project.ts "株式投資の基本" poc/scene/out/kabu_project.json 4
 *   .env.local の GEMINI_API_KEY を自動読込。未設定なら決定的モックにフォールバック。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { generateVideoProject } from "../src/lib/scene/generate";

for (const f of [".env.local", ".env"]) {
  try {
    const m = readFileSync(f, "utf8").match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m && !process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* ない場合は無視 */ }
}

async function main() {
  const theme = process.argv[2] ?? "株式投資の基本";
  const out = process.argv[3] ?? "poc/scene/out/kabu_project.json";
  const minutes = Number(process.argv[4] ?? 4);
  const r = await generateVideoProject({ theme, targetMinutes: minutes, audience: "投資初心者" });
  writeFileSync(out, JSON.stringify(r.project, null, 2), "utf8");
  const types = [...new Set(r.project.scenes.map((s) => s.visual.type))].join(", ");
  console.log(`provider=${r.provider} / title=${r.project.title}`);
  console.log(`scenes=${r.project.scenes.length} / types=${types}`);
  console.log(`保存: ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
