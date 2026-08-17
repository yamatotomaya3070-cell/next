// キャラクターセット レビューページ生成。masters + 表情 + ポーズ を1枚の自己完結HTMLに埋め込む。
//   サムネ(width 340)をdata URIにして CSP下でも表示可能に。承認レビュー(STEP8-9)用。
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT_HTML = process.argv[2] || 'gallery.html';

async function thumb(path, w = 340) {
  const buf = await sharp(readFileSync(path)).resize({ width: w }).png({ quality: 80 }).toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const HARU = {
  key: 'haru', name: 'ハル', role: '初心者 / 視聴者の分身 · 20-24歳 · calm blue',
  master: 'locked/haru_MASTER.png',
  expr: [
    ['neutral', 'ふつう', '平常・つなぎ'],
    ['curious', '興味', '疑問の導入'],
    ['surprised', '驚き', '数字・オチの反応'],
    ['worried', '不安', '「損しない？」'],
    ['thinking', '考え中', '咀嚼中'],
    ['understood', '納得', '理解の瞬間'],
    ['happy', '笑顔', '前向き・まとめ'],
  ],
  pose: [
    ['explaining', '説明ジェスチャ'],
    ['nodding', 'うなずき（聞き役）'],
    ['surprised', '驚き（のけぞり）'],
    ['thinking', '考えポーズ'],
  ],
};

const MINA = {
  key: 'mina', name: 'ミナ先生', role: '解説役 / 金融の先生 · 27-32歳 · 眼鏡固定 · calm green',
  master: 'locked/mina_MASTER.png',
  expr: [
    ['neutral', '真顔', '平常'],
    ['explaining', '説明', '解説の基本形'],
    ['pointing', '誘導', '図解へ注意を向ける'],
    ['caution', '注意', '「元本保証ではない」'],
    ['reassuring', '安心', '不安の払拭・共感'],
    ['thinking', '考え中', '補足の間'],
    ['positive', '前向き', 'まとめ・CTA'],
  ],
  pose: [
    ['pointing_left', '左を指す'],
    ['pointing_right', '右を指す'],
    ['explaining', '説明ジェスチャ'],
    ['nodding', 'うなずき（聞き役）'],
  ],
};

async function buildChar(c) {
  const masterUri = await thumb(c.master, 460);
  const exprCells = [];
  for (const [id, jp, use] of c.expr) {
    const p = `out/expr/${c.key}_${id}.png`;
    if (!existsSync(p)) continue;
    exprCells.push(`<figure class="cell"><img src="${await thumb(p)}" alt="${c.name} ${jp}"><figcaption><span class="jp">${jp}</span><span class="en">${id}</span><span class="use">${use}</span></figcaption></figure>`);
  }
  const poseCells = [];
  for (const [id, jp] of c.pose) {
    const p = `out/pose/${c.key}_${id}.png`;
    if (!existsSync(p)) continue;
    poseCells.push(`<figure class="cell"><img src="${await thumb(p)}" alt="${c.name} ${jp}"><figcaption><span class="jp">${jp}</span><span class="en">${id}</span></figcaption></figure>`);
  }
  return `
  <section class="char char--${c.key}">
    <div class="char__master">
      <span class="lockchip">◆ REFERENCE MASTER · ロック済</span>
      <img src="${masterUri}" alt="${c.name} MASTER">
      <h2>${c.name}</h2>
      <p class="role">${c.role}</p>
    </div>
    <div class="char__variants">
      <h3>表情 <span class="count">${exprCells.length}</span></h3>
      <div class="grid">${exprCells.join('')}</div>
      <h3>ポーズ <span class="count">${poseCells.length}</span></h3>
      <div class="grid">${poseCells.join('')}</div>
    </div>
  </section>`;
}

const haruHtml = await buildChar(HARU);
const minaHtml = await buildChar(MINA);
const total = HARU.expr.length + HARU.pose.length + MINA.expr.length + MINA.pose.length + 2;

const html = `<title>ハル & ミナ キャラクターシート</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{
  --paper:#F3F1EC; --ink:#1D1B16; --ink-soft:#5B564C; --line:#D9D4C8;
  --card:#FBFAF6; --haru:#3F6FA6; --mina:#6E9A5A; --lock:#B08A2E;
  --shadow:0 1px 2px rgba(40,35,20,.06),0 8px 24px rgba(40,35,20,.07);
}
:root:not([data-theme="light"]){ }
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --paper:#171613; --ink:#EDE9DF; --ink-soft:#A69F8E; --line:#33302A;
    --card:#201E1A; --haru:#7CA6D8; --mina:#9DC585; --lock:#D8B25A;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.5);
  }
}
:root[data-theme="dark"]{
  --paper:#171613; --ink:#EDE9DF; --ink-soft:#A69F8E; --line:#33302A;
  --card:#201E1A; --haru:#7CA6D8; --mina:#9DC585; --lock:#D8B25A;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.5);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:"Hiragino Kaku Gothic ProN","Yu Gothic UI",system-ui,-apple-system,sans-serif;
  line-height:1.6; -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1080px; margin:0 auto; padding:clamp(1.5rem,4vw,3.5rem) clamp(1rem,4vw,2rem)}
header.top{border-bottom:1px solid var(--line); padding-bottom:1.4rem; margin-bottom:2.4rem}
.eyebrow{font-size:.72rem; letter-spacing:.18em; text-transform:uppercase; color:var(--ink-soft); margin:0 0 .5rem}
h1{font-size:clamp(1.6rem,3.6vw,2.4rem); font-weight:800; margin:0; letter-spacing:-.01em; text-wrap:balance}
.sub{color:var(--ink-soft); margin:.6rem 0 0; max-width:60ch}
.meta{display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1.1rem}
.tag{font-size:.75rem; padding:.28rem .7rem; border:1px solid var(--line); border-radius:999px; color:var(--ink-soft); background:var(--card)}
.tag b{color:var(--ink); font-variant-numeric:tabular-nums}

.char{display:grid; grid-template-columns:minmax(240px,300px) 1fr; gap:clamp(1.2rem,3vw,2.4rem); padding:2rem 0; border-bottom:1px solid var(--line)}
.char:last-of-type{border-bottom:0}
.char__master{position:sticky; top:1.2rem; align-self:start}
.char__master img{width:100%; border-radius:14px; background:var(--card); border:1px solid var(--line); box-shadow:var(--shadow)}
.char__master h2{font-size:1.5rem; margin:.9rem 0 .1rem}
.char--haru h2{color:var(--haru)} .char--mina h2{color:var(--mina)}
.role{font-size:.82rem; color:var(--ink-soft); margin:.1rem 0 0}
.lockchip{display:inline-block; font-size:.68rem; letter-spacing:.08em; color:var(--lock); border:1px solid var(--lock); border-radius:6px; padding:.15rem .5rem; margin-bottom:.6rem}

.char__variants h3{font-size:.82rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-soft); margin:.2rem 0 .9rem; display:flex; align-items:center; gap:.5rem}
.char__variants h3:not(:first-child){margin-top:1.8rem}
.count{font-size:.7rem; color:var(--ink); background:var(--card); border:1px solid var(--line); border-radius:999px; padding:.05rem .5rem; font-variant-numeric:tabular-nums}
.grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(128px,1fr)); gap:.9rem}
.cell{margin:0; background:var(--card); border:1px solid var(--line); border-radius:11px; overflow:hidden; box-shadow:var(--shadow); transition:transform .15s ease, box-shadow .15s ease}
.cell:hover{transform:translateY(-2px); box-shadow:0 4px 10px rgba(40,35,20,.1),0 14px 30px rgba(40,35,20,.12)}
.cell img{display:block; width:100%; aspect-ratio:1/1; object-fit:cover; background:var(--paper)}
figcaption{padding:.5rem .6rem .6rem; display:flex; flex-direction:column; gap:.05rem}
.jp{font-weight:700; font-size:.9rem}
.en{font-size:.68rem; color:var(--ink-soft); letter-spacing:.02em}
.use{font-size:.7rem; color:var(--ink-soft); margin-top:.15rem}

footer{margin-top:2.6rem; padding-top:1.4rem; border-top:1px solid var(--line); color:var(--ink-soft); font-size:.8rem}
footer code{background:var(--card); border:1px solid var(--line); border-radius:5px; padding:.1rem .4rem; font-size:.9em}
@media (max-width:640px){
  .char{grid-template-columns:1fr}
  .char__master{position:static}
}
@media (prefers-reduced-motion:reduce){ .cell{transition:none} }
</style>

<div class="wrap">
  <header class="top">
    <p class="eyebrow">金融解説YouTube · チャンネルの顔</p>
    <h1>ハル & ミナ キャラクターシート</h1>
    <p class="sub">再設計で確定した2キャラの立ち絵アセット一式。ロック済みMASTERを原本に、image-to-image で表情・ポーズ差分を生成（全て同一人物性を維持）。100本超の動画で使い回す基準セット。</p>
    <div class="meta">
      <span class="tag">合計 <b>${total}</b> アセット</span>
      <span class="tag">MASTER <b>2</b>（ロック済）</span>
      <span class="tag">表情 <b>14</b></span>
      <span class="tag">ポーズ <b>8</b></span>
      <span class="tag">生成 · gemini-2.5-flash-image</span>
    </div>
  </header>
  ${haruHtml}
  ${minaHtml}
  <footer>
    原本: <code>poc/character/locked/{haru,mina}_MASTER.png</code> ／ 差分: <code>out/expr/</code>・<code>out/pose/</code>。
    承認後の次工程 = 見本リールの仮シルエットを本アセットへ差し替え、および character_assets への資産化（is_master/is_approved 付き）。
  </footer>
</div>`;

writeFileSync(OUT_HTML, html);
console.log(`wrote ${OUT_HTML} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
