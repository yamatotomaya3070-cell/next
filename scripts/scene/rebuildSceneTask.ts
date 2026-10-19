// 登録済みの案件を、今の作り方（timing.mjs・build_materials など）で作り直して置き換える。
// 台本と声は前のパッケージのものをそのまま使う（声を作り直さないので API キーは要らない）。
//   使い方: npx tsx scripts/scene/rebuildSceneTask.ts <project.json> <前のパッケージ> <出力フォルダ> [案件ID]
//   案件ID を付けたときだけ本番の案件を置き換える。付けなければ作って確かめるだけ。
//   --reuse-sample を付けると、出力フォルダに前回作った完成見本と場面の映像があればそれを使い、
//   書き出し（1本30分ほど・メモリを多く使う）を飛ばす。見本が変わらない作り直し（支給素材だけ）のとき用。
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { verifyPackage } from "./verifyPackage";
import { updateSceneTask } from "./registerSceneTask";
import { logLine, runStep } from "./runStep";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// build_materials.mjs が支給する声を -3dB 下げているので、見本用には戻す
const VOICE_GAIN_RESTORE_DB = 3;

// 何をしていて・どこで止まったかを残す。出力フォルダの「作り直しの記録.txt」
let LOG_FILE: string | undefined;

function run(step: string, cmd: string, args: string[], env: Record<string, string> = {}) {
  return runStep(step, cmd, args, { env, logFile: LOG_FILE });
}

interface VoicePad {
  leadF: number;
  lenF: number;
  trailF: number;
}

/** 素材一覧.json に書いてある、支給音声に足した無音（2026-10-16 より前のパッケージには無い） */
function readPads(oldPkg: string): Map<string, VoicePad> {
  const file = `${oldPkg}/素材一覧.json`;
  if (!existsSync(file)) return new Map();
  const manifest = JSON.parse(readFileSync(file, "utf8")) as {
    scenes: { lines: { audio: string; pad?: VoicePad }[] }[];
  };
  return new Map(
    manifest.scenes
      .flatMap((sc) => sc.lines)
      .filter((l) => l.pad)
      .map((l) => [l.audio.split("/").pop()!, l.pad!]),
  );
}

const FPS = 24;
/** 声だけに戻すとき、後ろに 1/4 フレーム無音を残す（長さを秒×24の切り捨てで数えても lenF を割らないように） */
const RESTORE_SAFETY_F = 0.25;

/** 前のパッケージの 素材/音声/S01_02_ハル.wav → vox/s001_l1.wav（render_project が使う名前） */
async function restoreVox(oldPkg: string, voxDir: string) {
  rmSync(voxDir, { recursive: true, force: true });
  mkdirSync(voxDir, { recursive: true });
  const pads = readPads(oldPkg);
  const dir = `${oldPkg}/素材/音声`;
  const names = readdirSync(dir).filter((n) => /^S\d{2}_\d{2}_.+\.wav$/.test(n));
  for (const n of names) {
    const scene = Number(n.slice(1, 3));
    const line = Number(n.slice(4, 6)) - 1;
    const dst = `${voxDir}/s${String(scene).padStart(3, "0")}_l${line}.wav`;
    // 無音を足した音声は、声の部分（lenF フレーム）だけ切り出す。足した無音まで声の長さに数えると場面の長さが変わる
    const pad = pads.get(n);
    const trim = pad
      ? [`atrim=start=${pad.leadF / FPS}:end=${(pad.leadF + pad.lenF + RESTORE_SAFETY_F) / FPS}`, "asetpts=PTS-STARTPTS"]
      : [];
    const af = [...trim, `volume=${VOICE_GAIN_RESTORE_DB}dB`].join(",");
    await run(`声の取り出し（${n}）`, "ffmpeg", ["-y", "-v", "error", "-i", `${dir}/${n}`, "-af", af, "-c:a", "pcm_s16le", dst]);
  }
  return names.length;
}

/** 前回のパッケージの 素材/映像/S01_会話.mp4 → visual_assets/visual_001.mp4（build_materials が探す名前） */
function reuseVisuals(pkg: string, visualDir: string): number {
  const dir = `${pkg}/素材/映像`;
  const names = readdirSync(dir).filter((n) => /^S\d{2}_.+\.mp4$/.test(n));
  mkdirSync(visualDir, { recursive: true });
  for (const n of names) copyFileSync(`${dir}/${n}`, `${visualDir}/visual_${n.slice(1, 3).padStart(3, "0")}.mp4`);
  return names.length;
}

async function main() {
  const args = process.argv.slice(2);
  const reuseSample = args.includes("--reuse-sample");
  const [project, oldPkg, outDir, taskId] = args.filter((a) => a !== "--reuse-sample");
  if (!project || !oldPkg || !outDir) {
    throw new Error("使い方: npx tsx scripts/scene/rebuildSceneTask.ts <project.json> <前のパッケージ> <出力フォルダ> [案件ID]");
  }
  const vox = `${outDir}/vox`;
  const work = `${outDir}/work`;
  const pkg = `${outDir}/package`;
  const sample = `${outDir}/sample.mp4`;
  mkdirSync(outDir, { recursive: true });
  LOG_FILE = `${outDir}/作り直しの記録.txt`;
  logLine(LOG_FILE, `作り直し開始: ${project}${taskId ? `（案件 ${taskId} を置き換える）` : "（確かめるだけ）"}`);
  console.log(`声 ${await restoreVox(oldPkg, vox)}本を前のパッケージから戻しました`);

  const env = { SCENE_WORK_DIR: work, SCENE_VOX_DIR: vox, SCENE_VISUAL_ASSET_DIR: `${work}/visual_assets` };
  rmSync(work, { recursive: true, force: true });
  if (reuseSample && existsSync(sample) && existsSync(`${pkg}/素材/映像`)) {
    console.log(`完成見本と場面の映像 ${reuseVisuals(pkg, env.SCENE_VISUAL_ASSET_DIR)}本は前回のものを使います`);
  } else {
    await run("完成見本の書き出し", "node", ["poc/scene/render_project.mjs", project, sample], env);
  }
  await run("素材の書き出し", "node", ["poc/scene/build_materials.mjs", project, pkg], { ...env, SAMPLE_VIDEO: sample });
  await run("手順書の作成", "node", ["poc/scene/build_manual.mjs", pkg]);
  await run("依頼書・作業指示一覧の作成", "node", ["poc/scene/build_app_task.mjs", pkg]);
  const r = verifyPackage(pkg);
  const ok = `関門OK: 並べた長さ ${r.totalFrames}f / 完成見本 ${r.sampleFrames}f / セリフ ${r.voices}本`;
  console.log(ok);
  logLine(LOG_FILE, ok);

  if (!taskId) return;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  await updateSceneTask(sb, { pkgDir: pkg, taskId });
  console.log(`案件 ${taskId} を置き換えました`);
  logLine(LOG_FILE, `案件 ${taskId} を置き換えました`);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  if (LOG_FILE) {
    logLine(LOG_FILE, `止まりました: ${msg}`);
    console.error(`記録: ${LOG_FILE}`);
  }
  process.exit(1);
});
