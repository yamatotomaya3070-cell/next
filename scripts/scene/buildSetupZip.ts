// 各パソコンの準備に使う「字幕の型・スクリプト・書き出し設定」を ZIP にし、
// 教科書（第10章 パソコンの準備）からダウンロードできるよう public に置く。
// 型やスクリプトを直したら、これを実行して ZIP を作り直す。
//   使い方: npx tsx scripts/scene/buildSetupZip.ts [05_テンプレートのフォルダ]
import { existsSync, mkdirSync } from "node:fs";
import { zipPaths } from "./zipFolder";

const SRC = process.argv[2] ?? "テスト用_動画編集パッケージ/05_テンプレート";
const OUT_DIR = "public/guide/setup";
const OUT = `${OUT_DIR}/kizuna_davinci_setup.zip`;
const CONTENTS = ["セットアップ（職員用）.bat", "スクリプト", "字幕とテロップ"];

for (const p of CONTENTS) {
  if (!existsSync(`${SRC}/${p}`)) throw new Error(`見つかりません: ${SRC}/${p}`);
}
mkdirSync(OUT_DIR, { recursive: true });
zipPaths(SRC, CONTENTS, OUT);
console.log(`作成: ${OUT}`);
