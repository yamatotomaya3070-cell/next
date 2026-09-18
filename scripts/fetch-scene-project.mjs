import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const taskId = process.argv[2];
const outputPath = process.argv[3];
if (!taskId || !outputPath) {
  throw new Error("Usage: node scripts/fetch-scene-project.mjs TASK_ID OUTPUT_PATH");
}

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) continue;
  env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const url = new URL("/rest/v1/scene_jobs", env.NEXT_PUBLIC_SUPABASE_URL);
url.searchParams.set("select", "id,status,project");
url.searchParams.set("task_id", `eq.${taskId}`);
url.searchParams.set("order", "created_at.desc");
url.searchParams.set("limit", "1");

const response = await fetch(url, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
const [job] = await response.json();
if (!job?.project?.scenes?.length) throw new Error("Scene project was not found");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(job.project, null, 2), "utf8");
console.log(JSON.stringify({ jobId: job.id, status: job.status, title: job.project.title, scenes: job.project.scenes.length, outputPath }));
