// 背景透過（縁からのflood-fill）。生成立ち絵はクリーム無地背景=外周に繋がった背景だけ透明化。
//   グローバル閾値と違い、白シャツ等の内側は外周と繋がらないので消えない。
//   使い方: node cutout.mjs <in.png> <out.png> [tolerance]
import sharp from 'sharp';

const [, , inPath, outPath, tolArg] = process.argv;
if (!inPath || !outPath) { console.error('usage: node cutout.mjs <in> <out> [tol]'); process.exit(1); }
const TOL = Number(tolArg ?? 42);

const img = sharp(inPath).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels } = info; // channels=4
const idx = (x, y) => (y * W + x) * channels;

// 背景色 = 四隅の平均
function corner(x, y) { const i = idx(x, y); return [data[i], data[i + 1], data[i + 2]]; }
const corners = [corner(0, 0), corner(W - 1, 0), corner(0, H - 1), corner(W - 1, H - 1)];
const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, k) => s + k[c], 0) / corners.length));
const near = (i) => {
  const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) <= TOL;
};

// flood fill（スタック）: 外周から背景色に近い連結領域をalpha=0に
const visited = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) { stack.push([x, 0]); stack.push([x, H - 1]); }
for (let y = 0; y < H; y++) { stack.push([0, y]); stack.push([W - 1, y]); }
let cleared = 0;
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const p = y * W + x;
  if (visited[p]) continue;
  visited[p] = 1;
  const i = p * channels;
  if (!near(i)) continue;         // 背景色でない=境界（線画）で止まる
  data[i + 3] = 0; cleared++;      // 透明化
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

// 半透明の縁を1px軽く締める（にじみ低減）: 透明隣接の不透明端をやや減衰
await sharp(data, { raw: { width: W, height: H, channels } }).png().toFile(outPath);
console.log(`cutout ${outPath}  bg=rgb(${bg})  cleared=${cleared}/${W * H} (${(cleared / (W * H) * 100).toFixed(1)}%)`);
