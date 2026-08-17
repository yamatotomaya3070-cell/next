// 全表情(ハル7/ミナ7)を 背景透過→余白トリム→高さ540 に整えて reel/ へ。
//   conversation.mjs が感情に応じて表情を差し替えるための素材づくり。
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HARU = ['neutral', 'curious', 'surprised', 'worried', 'thinking', 'understood', 'happy'];
const MINA = ['neutral', 'explaining', 'pointing', 'caution', 'reassuring', 'thinking', 'positive'];
const OUT = 'out/cutout/reel';
mkdirSync(OUT, { recursive: true });

// 縁flood-fill透過（cutout.mjsと同ロジックを内蔵）
async function cutout(inPath, tol = 42) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels } = info;
  const idx = (x, y) => (y * W + x) * channels;
  const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => { const i = idx(x, y); return [data[i], data[i + 1], data[i + 2]]; });
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, k) => s + k[c], 0) / corners.length));
  const near = (i) => { const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2]; return Math.sqrt(dr * dr + dg * dg + db * db) <= tol; };
  const visited = new Uint8Array(W * H); const stack = [];
  for (let x = 0; x < W; x++) { stack.push([x, 0]); stack.push([x, H - 1]); }
  for (let y = 0; y < H; y++) { stack.push([0, y]); stack.push([W - 1, y]); }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x; if (visited[p]) continue; visited[p] = 1;
    const i = p * channels; if (!near(i)) continue; data[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return sharp(data, { raw: { width: W, height: H, channels } }).png().toBuffer();
}

for (const [id, set] of [['haru', HARU], ['mina', MINA]]) {
  for (const expr of set) {
    const src = `out/expr/${id}_${expr}.png`;
    if (!existsSync(src)) { console.log('skip(no src):', src); continue; }
    const cut = await cutout(src);
    const trimmed = await sharp(cut).trim({ threshold: 10 }).toBuffer();
    await sharp(trimmed).resize({ height: 540 }).png().toFile(`${OUT}/${id}_${expr}.png`);
    process.stdout.write(`${id}_${expr} `);
  }
}
console.log('\n完了:', OUT);
