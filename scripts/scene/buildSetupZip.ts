// 各パソコンの準備に使う「字幕の型・スクリプト・書き出し設定」を ZIP にし、
// 教科書（第10章 パソコンの準備）からダウンロードできるよう public に置く。
// 型やスクリプトを直したら、これを実行して ZIP を作り直す（Windows 用と Mac 用の両方）。
//   使い方: npx tsx scripts/scene/buildSetupZip.ts [05_テンプレートのフォルダ] [Mac用セットアップの親フォルダ]
// Mac 用は字幕の型のフォントだけが違う（Yu Gothic UI は Mac に無いので Hiragino Sans）。
// スクリプト（絆_素材を並べる.lua）は Windows 用と同じものを入れる。
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { zipPaths } from "./zipFolder";

const SRC = process.argv[2] ?? "テスト用_動画編集パッケージ/05_テンプレート";
const MAC_PARENT = process.argv[3] ?? "../Mac検証用_セットアップ";
const MAC_DIR = "kizuna_davinci_setup_mac";
const OUT_DIR = "public/guide/setup";
const OUT = `${OUT_DIR}/kizuna_davinci_setup.zip`;
const OUT_MAC = `${OUT_DIR}/kizuna_davinci_setup_mac.zip`;
const CONTENTS = ["セットアップ（職員用）.bat", "スクリプト", "字幕とテロップ"];
const SCRIPT = "スクリプト/絆_素材を並べる.lua";

for (const p of CONTENTS) {
  if (!existsSync(`${SRC}/${p}`)) throw new Error(`見つかりません: ${SRC}/${p}`);
}
mkdirSync(OUT_DIR, { recursive: true });
zipPaths(SRC, CONTENTS, OUT);
console.log(`作成: ${OUT}`);

const mac = `${MAC_PARENT}/${MAC_DIR}`;
if (existsSync(mac)) {
  // スクリプトは Windows 用と同じものにそろえる（片方だけ直し忘れないように）
  copyFileSync(`${SRC}/${SCRIPT}`, `${mac}/${SCRIPT}`);
  for (const name of ["絆_強調テロップ", "絆_字幕_ナレーション", "絆_字幕_ハル", "絆_字幕_ミナ先生"]) {
    const text = readFileSync(`${mac}/字幕とテロップ/${name}.setting`, "utf8");
    if (text.includes("Yu Gothic UI")) throw new Error(`Mac 用の ${name} が Yu Gothic UI のままです`);
  }
  zipPaths(MAC_PARENT, [MAC_DIR], OUT_MAC);
  console.log(`作成: ${OUT_MAC}`);
} else {
  console.log(`Mac 用のフォルダが無いので作りません: ${mac}`);
}
