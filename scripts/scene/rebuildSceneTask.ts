// 登録済みの案件を、今の作り方（timing.mjs・build_materials など）で作り直して置き換える。
// 台本と声は前のパッケージのものをそのまま使う（声を作り直さないので API キーは要らない）。
//   使い方: npx tsx scripts/scene/rebuildSceneTask.ts <project.json> <前のパッケージ> <出力フォルダ> [案件ID]
//   案件ID を付けたときだけ本番の案件を置き換える。付けなければ作って確かめるだけ。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { verifyPackage } from "./verifyPackage";
import { updateSceneTask } from "./registerSceneTask";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// build_materials.mjs が支給する声を -3dB 下げているので、見本用には戻す
const VOICE_GAIN_RESTORE_DB = 3;

function run(cmd: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`失敗: ${cmd} ${args.join(" ")}`);
}

/** 前のパッケージの 素材/音声/S01_02_ハル.wav → vox/s001_l1.wav（render_project が使う名前） */
function restoreVox(oldPkg: string, voxDir: string) {
  rmSync(voxDir, { recursive: true, force: true });
  mkdirSync(voxDir, { recursive: true });
  const dir = `${oldPkg}/素材/音声`;
  const names = readdirSync(dir).filter((n) => /^S\d{2}_\d{2}_.+\.wav$/.test(n));
  for (const n of names) {
    const scene = Number(n.slice(1, 3));
    const line = Number(n.slice(4, 6)) - 1;
    const dst = `${voxDir}/s${String(scene).padStart(3, "0")}_l${line}.wav`;
    run("ffmpeg", ["-y", "-v", "error", "-i", `${dir}/${n}`, "-af", `volume=${VOICE_GAIN_RESTORE_DB}dB`, "-c:a", "pcm_s16le", dst]);
  }
  return names.length;
}

async function main() {
  const [project, oldPkg, outDir, taskId] = process.argv.slice(2);
  if (!project || !oldPkg || !outDir) {
    throw new Error("使い方: npx tsx scripts/scene/rebuildSceneTask.ts <project.json> <前のパッケージ> <出力フォルダ> [案件ID]");
  }
  const vox = `${outDir}/vox`;
  const work = `${outDir}/work`;
  const pkg = `${outDir}/package`;
  const sample = `${outDir}/sample.mp4`;
  mkdirSync(outDir, { recursive: true });
  console.log(`声 ${restoreVox(oldPkg, vox)}本を前のパッケージから戻しました`);

  const env = { SCENE_WORK_DIR: work, SCENE_VOX_DIR: vox, SCENE_VISUAL_ASSET_DIR: `${work}/visual_assets` };
  rmSync(work, { recursive: true, force: true });
  run("node", ["poc/scene/render_project.mjs", project, sample], env);
  run("node", ["poc/scene/build_materials.mjs", project, pkg], { ...env, SAMPLE_VIDEO: sample });
  run("node", ["poc/scene/build_manual.mjs", pkg]);
  run("node", ["poc/scene/build_app_task.mjs", pkg]);
  const r = verifyPackage(pkg);
  console.log(`関門OK: 並べた長さ ${r.totalFrames}f / 完成見本 ${r.sampleFrames}f / セリフ ${r.voices}本`);

  if (!taskId) return;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  await updateSceneTask(sb, { pkgDir: pkg, taskId });
  console.log(`案件 ${taskId} を置き換えました`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
