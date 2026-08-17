// SCENE生成の通しスモーク: テーマ → VideoProject → 検証。
//   実Gemini(GEMINI_API_KEY)があればGemini、無ければmock。結果を poc/scene/out/ に保存。
//   使い方: npx tsx scripts/scene/smoke-generate.ts ["テーマ"] [分]
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { generateVideoProject } from "../../src/lib/scene/generate";
import { validateVideoProject } from "../../src/lib/scene/validate";

// .env.local から GEMINI_API_KEY / GEMINI_MODEL を読む（無ければmock）
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^(GEMINI_API_KEY|GEMINI_MODEL)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const theme = process.argv[2] || "新NISAって結局何？";
const minutes = Number(process.argv[3] || 10);

async function main() {
const { project, provider } = await generateVideoProject({ theme, targetMinutes: minutes });
const report = validateVideoProject(project);

mkdirSync("poc/scene/out", { recursive: true });
writeFileSync("poc/scene/out/newnisa_project.json", JSON.stringify(project, null, 2));
writeFileSync("poc/scene/out/newnisa_report.json", JSON.stringify(report, null, 2));

console.log(`\n=== SCENE生成 (${provider}) ===`);
console.log(`title       : ${project.title}`);
console.log(`goal        : ${project.goal}`);
console.log(`scenes      : ${report.sceneCount}`);
console.log(`sections    : ${report.sections.join(" → ")}`);
console.log(`missing     : ${report.missingSections.join(", ") || "なし"}`);
console.log(`estimatedSec: ${report.estimatedSec} (約${(report.estimatedSec / 60).toFixed(1)}分)`);
console.log(`ok          : ${report.ok}`);
console.log(`issues      : ${report.issues.length}`);
for (const i of report.issues.slice(0, 12)) console.log(`  [${i.level}] ${i.sceneId}: ${i.message}`);

console.log("\n--- 各シーン ---");
for (const s of project.scenes) {
  const spk = s.audio.map((a) => a.speaker).join("+") || "無音";
  const info = s.visual.infographic ? `+${s.visual.infographic.kind}` : "";
  console.log(`  ${s.id} [${s.section}] ${s.visual.type}${info} (${spk}) — ${s.visual.description.slice(0, 30)}`);
}
console.log("\n保存: poc/scene/out/newnisa_project.json / newnisa_report.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
