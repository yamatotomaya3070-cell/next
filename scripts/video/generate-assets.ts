/**
 * 共通素材の生成（1回実行して assets/video/ にコミットする）
 * - オリジナルキャラクター立ち絵 2体 × 3表情（SVGで描画 → PNG化）
 * - 背景画像 1920x1080
 * - BGMループ（ffmpegで合成した静かなパッド音）
 *
 * キャラクターは既存キャラクターの模倣を避けた自作のシンプルなマスコット。
 * 使い方: npx tsx scripts/video/generate-assets.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { CharacterExpression } from "../../src/lib/video/templates/characterExplainer";
import { CHARACTER_EXPRESSIONS } from "../../src/lib/video/templates/characterExplainer";

const OUT_DIR = join("assets", "video");
const CHAR_W = 480;
const CHAR_H = 640;

interface CharacterTheme {
  key: string;
  base: string; // 体の色
  dark: string; // 輪郭・濃い部分
  accent: string; // 頬・飾り
}

const AO: CharacterTheme = { key: "ao", base: "#5B8DEF", dark: "#2F5FC4", accent: "#FFB3C1" };
const MIDORI: CharacterTheme = { key: "midori", base: "#5FBF77", dark: "#2E8B4A", accent: "#FFD166" };

function eyes(expression: CharacterExpression): string {
  if (expression === "surprised") {
    return `
      <circle cx="185" cy="255" r="34" fill="#fff"/>
      <circle cx="295" cy="255" r="34" fill="#fff"/>
      <circle cx="185" cy="258" r="14" fill="#222"/>
      <circle cx="295" cy="258" r="14" fill="#222"/>
      <path d="M150 200 Q185 185 220 200" stroke="#222" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M260 200 Q295 185 330 200" stroke="#222" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  }
  if (expression === "happy") {
    return `
      <path d="M155 255 Q185 230 215 255" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M265 255 Q295 230 325 255" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  }
  return `
    <circle cx="185" cy="250" r="30" fill="#fff"/>
    <circle cx="295" cy="250" r="30" fill="#fff"/>
    <circle cx="192" cy="254" r="13" fill="#222"/>
    <circle cx="302" cy="254" r="13" fill="#222"/>`;
}

function mouth(expression: CharacterExpression): string {
  if (expression === "surprised") {
    return `<ellipse cx="240" cy="320" rx="22" ry="30" fill="#663333"/>`;
  }
  if (expression === "happy") {
    return `<path d="M200 310 Q240 350 280 310 Z" fill="#663333"/>
            <path d="M200 310 Q240 350 280 310" stroke="#222" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
  return `<path d="M215 315 Q240 332 265 315" stroke="#222" stroke-width="8" fill="none" stroke-linecap="round"/>`;
}

/** アオ: 青いロボット風マスコット（アンテナ+四角い耳） */
function aoSvg(expression: CharacterExpression): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHAR_W}" height="${CHAR_H}" viewBox="0 0 480 640">
  <line x1="240" y1="60" x2="240" y2="110" stroke="${AO.dark}" stroke-width="10"/>
  <circle cx="240" cy="52" r="18" fill="${AO.accent}" stroke="${AO.dark}" stroke-width="6"/>
  <rect x="70" y="180" width="46" height="90" rx="16" fill="${AO.base}" stroke="${AO.dark}" stroke-width="8"/>
  <rect x="364" y="180" width="46" height="90" rx="16" fill="${AO.base}" stroke="${AO.dark}" stroke-width="8"/>
  <rect x="95" y="110" width="290" height="270" rx="90" fill="${AO.base}" stroke="${AO.dark}" stroke-width="10"/>
  <rect x="120" y="150" width="240" height="200" rx="70" fill="#EAF1FF"/>
  ${eyes(expression)}
  ${mouth(expression)}
  <circle cx="140" cy="300" r="18" fill="${AO.accent}" opacity="0.8"/>
  <circle cx="340" cy="300" r="18" fill="${AO.accent}" opacity="0.8"/>
  <rect x="140" y="380" width="200" height="170" rx="60" fill="${AO.base}" stroke="${AO.dark}" stroke-width="10"/>
  <rect x="190" y="420" width="100" height="60" rx="16" fill="#EAF1FF" stroke="${AO.dark}" stroke-width="6"/>
  <circle cx="240" cy="450" r="14" fill="${AO.dark}"/>
  <ellipse cx="185" cy="570" rx="45" ry="26" fill="${AO.dark}"/>
  <ellipse cx="295" cy="570" rx="45" ry="26" fill="${AO.dark}"/>
</svg>`;
}

/** ミドリ: 緑の妖精風マスコット（頭に葉っぱ+丸い体） */
function midoriSvg(expression: CharacterExpression): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHAR_W}" height="${CHAR_H}" viewBox="0 0 480 640">
  <path d="M240 105 Q225 55 185 45 Q230 40 250 75 Q255 40 300 35 Q265 60 252 105 Z" fill="${MIDORI.dark}"/>
  <circle cx="240" cy="255" r="160" fill="${MIDORI.base}" stroke="${MIDORI.dark}" stroke-width="10"/>
  <circle cx="240" cy="270" r="122" fill="#F0FBEF"/>
  ${eyes(expression)}
  ${mouth(expression)}
  <circle cx="145" cy="298" r="18" fill="${MIDORI.accent}" opacity="0.85"/>
  <circle cx="335" cy="298" r="18" fill="${MIDORI.accent}" opacity="0.85"/>
  <ellipse cx="240" cy="480" rx="120" ry="90" fill="${MIDORI.base}" stroke="${MIDORI.dark}" stroke-width="10"/>
  <ellipse cx="240" cy="480" rx="70" ry="52" fill="#F0FBEF"/>
  <ellipse cx="150" cy="430" rx="34" ry="22" fill="${MIDORI.base}" stroke="${MIDORI.dark}" stroke-width="8" transform="rotate(-30 150 430)"/>
  <ellipse cx="330" cy="430" rx="34" ry="22" fill="${MIDORI.base}" stroke="${MIDORI.dark}" stroke-width="8" transform="rotate(30 330 430)"/>
  <ellipse cx="190" cy="575" rx="42" ry="24" fill="${MIDORI.dark}"/>
  <ellipse cx="290" cy="575" rx="42" ry="24" fill="${MIDORI.dark}"/>
</svg>`;
}

function backgroundSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FDF6EC"/>
      <stop offset="1" stop-color="#F2E8D8"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <circle cx="1700" cy="150" r="220" fill="#F7E3C0" opacity="0.5"/>
  <circle cx="200" cy="900" r="300" fill="#EAD9BE" opacity="0.4"/>
  <rect x="0" y="880" width="1920" height="200" fill="#E5D5BC"/>
  <rect x="240" y="120" width="1440" height="640" rx="28" fill="#FFFFFF" opacity="0.85"/>
  <rect x="240" y="120" width="1440" height="640" rx="28" fill="none" stroke="#D8C6A8" stroke-width="6"/>
</svg>`;
}

/** 縦型ショート用の背景（1080x1920）。カード枠は上寄せ、下側に立ち絵の余白を確保 */
function verticalBackgroundSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FDF6EC"/>
      <stop offset="1" stop-color="#F2E8D8"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  <circle cx="920" cy="180" r="220" fill="#F7E3C0" opacity="0.5"/>
  <circle cx="120" cy="1500" r="260" fill="#EAD9BE" opacity="0.4"/>
  <rect x="0" y="1500" width="1080" height="420" fill="#E5D5BC"/>
  <rect x="70" y="140" width="940" height="760" rx="32" fill="#FFFFFF" opacity="0.85"/>
  <rect x="70" y="140" width="940" height="760" rx="32" fill="none" stroke="#D8C6A8" stroke-width="6"/>
</svg>`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const theme of [AO, MIDORI]) {
    for (const expression of CHARACTER_EXPRESSIONS) {
      const svg = theme.key === "ao" ? aoSvg(expression) : midoriSvg(expression);
      const out = join(OUT_DIR, `${theme.key}_${expression}.png`);
      await sharp(Buffer.from(svg)).png().toFile(out);
      console.log(`生成: ${out}`);
    }
  }

  await sharp(Buffer.from(backgroundSvg())).png().toFile(join(OUT_DIR, "bg_default.png"));
  console.log(`生成: ${join(OUT_DIR, "bg_default.png")}`);

  await sharp(Buffer.from(verticalBackgroundSvg())).png().toFile(join(OUT_DIR, "bg_vertical.png"));
  console.log(`生成: ${join(OUT_DIR, "bg_vertical.png")}`);

  // BGM: 静かなパッド音のループ（16秒）。ナレーションを邪魔しない音量で合成する
  const bgmPath = join(OUT_DIR, "bgm_loop.wav");
  execFileSync("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", "sine=frequency=261.63:duration=16",
    "-f", "lavfi", "-i", "sine=frequency=329.63:duration=16",
    "-f", "lavfi", "-i", "sine=frequency=392.00:duration=16",
    "-filter_complex",
    "[0:a][1:a][2:a]amix=inputs=3:normalize=1,tremolo=f=0.4:d=0.4,volume=0.5,afade=t=in:d=2,afade=t=out:st=14:d=2",
    "-ar", "44100", "-ac", "2",
    bgmPath,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  console.log(`生成: ${bgmPath}`);
  console.log("共通素材の生成が完了しました");
}

main().catch((err) => {
  console.error("素材生成に失敗:", err);
  process.exit(1);
});
