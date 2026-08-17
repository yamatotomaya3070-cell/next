/**
 * 立ち絵生成（Stage3）のスモークテスト。
 * 既定はモック（sharpでSVG→PNG、DB/APIキー不要）。--real で実Gemini画像生成を試す。
 * 生成した画像は scratch フォルダに書き出して目視確認できる。
 *
 * 実行: npx tsx scripts/video/smoke-character-image.ts [--real] [出力先ディレクトリ]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateCharacterExpressionSet } from "../../src/lib/image-gen";
import { normalizeStyleGuide } from "../../src/lib/style-guide/schema";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]; // ‰PNG

function isPng(bytes: Uint8Array): boolean {
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

async function main() {
  const args = process.argv.slice(2);
  const useReal = args.includes("--real");
  const outDir = args.find((a) => !a.startsWith("--")) ?? join("scripts", "output", "smoke-char");
  if (useReal) process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY; // 明示（--realでも未設定ならmock）

  const guide = normalizeStyleGuide({
    name: "スモーク",
    artStyle: "やわらかいアニメ調、フラット塗り",
    negativeStyle: "指の破綻、既存キャラの模倣",
    palette: { background: "#F4F7FB", primary: "#5B8DEF", accent: "#FFB020" },
    characters: [
      { key: "ao", name: "アオ", appearance: "青いロボット風マスコット", seed: 1000 },
    ],
  });

  const char = guide.characters[0];
  console.log(`char=${char.key} seed=${char.seed} (${useReal ? "real希望" : "mock"})`);

  const set = await generateCharacterExpressionSet({
    characterKey: char.key,
    appearance: char.appearance,
    artStyle: guide.artStyle,
    negativeStyle: guide.negativeStyle,
    palette: guide.palette,
    seed: char.seed,
  });

  mkdirSync(outDir, { recursive: true });
  let allPng = true;
  for (const item of set) {
    const png = isPng(item.image.bytes);
    if (!png) allPng = false;
    const path = join(outDir, `${char.key}_${item.expression}.png`);
    writeFileSync(path, Buffer.from(item.image.bytes));
    console.log(
      `${png ? "PASS" : "FAIL"} ${item.expression.padEnd(10)} provider=${item.provider.padEnd(14)} ${item.image.bytes.length}B → ${path}`,
    );
  }

  const expectedExpressions = ["normal", "happy", "surprised", "thinking"];
  const gotExpressions: string[] = set.map((s) => s.expression);
  const allExpressions = expectedExpressions.every((e) => gotExpressions.includes(e));

  console.log("---");
  console.log(`${allExpressions ? "PASS" : "FAIL"} : 4表情そろっている`);
  console.log(`${allPng ? "PASS" : "FAIL"} : すべて有効なPNG`);

  if (!allExpressions || !allPng) {
    console.error("スモーク失敗");
    process.exit(1);
  }
  console.log("スモーク成功");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
