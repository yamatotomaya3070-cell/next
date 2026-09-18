// 案件を作るパソコン（ワーカー）のセットアップ一式を ZIP にし、
// 教科書（第11章 案件を作るパソコンの準備）からダウンロードできるよう public に置く。
// scripts/worker-setup の中身を直したら、これを実行して ZIP を作り直す。
//   使い方: npx tsx scripts/scene/buildWorkerSetupZip.ts
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { zipPaths } from "./zipFolder";

const SRC = "scripts/worker-setup";
const OUT_DIR = "public/guide/setup";
const OUT = `${OUT_DIR}/kizuna_worker_setup.zip`;

const contents = readdirSync(SRC).sort();
if (contents.length === 0) throw new Error(`${SRC} が空です`);
mkdirSync(OUT_DIR, { recursive: true });
zipPaths(SRC, contents, OUT);
console.log(`作成: ${OUT} (${Math.round(statSync(OUT).size / 1024)}KB, ${contents.length} files)`);
