// MASTER候補6案の選定ページを生成（STEP4：人間が各1案を選ぶ）。埋め込みは560px幅に縮小。
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = 'poc/character/out';
const manifest = JSON.parse(readFileSync(`${OUT}/manifest.json`, 'utf8'));
const target = process.argv[2] || 'review.html';

async function thumb(file) {
  const buf = await sharp(`${OUT}/${file}`).resize({ width: 560 }).png({ quality: 80 }).toBuffer();
  return buf.toString('base64');
}
const imgs = {};
for (const m of manifest) imgs[m.file] = await thumb(m.file);

const card = (id, n, b) => `<figure class="cand"><img src="data:image/png;base64,${b}" alt="${id} ${n}"><figcaption><b>${id === 'haru' ? 'ハル' : 'ミナ先生'} 案${n}</b> <span class="fn">${id}_master_${n}.png</span></figcaption></figure>`;
const group = (id, title, sub) => `<h2>${title} <small>${sub}</small></h2><div class="grid">${manifest.filter(m => m.id === id).map(m => card(id, m.n, imgs[m.file])).join('')}</div>`;

const html = `<title>ハル/ミナ MASTER候補 — 選定</title>
<style>
:root{--paper:#f5f4ef;--surface:#fffefb;--surface-2:#ecebe3;--ink:#1b1f24;--ink-soft:#4a4f57;--ink-faint:#7d838c;--line:#dad7cd;--accent:#1f6f6b;--accent-ink:#114b48;--accent-soft:#d9e8e6;--blue:#4F7CC9;--green:#3E9B79;--shadow:0 1px 2px rgba(20,22,26,.05),0 6px 24px rgba(20,22,26,.06);--mono:"SFMono-Regular",Consolas,monospace;--jp:"Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",Meiryo,sans-serif;}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#131519;--surface:#1a1d22;--surface-2:#23272e;--ink:#e9e7e0;--ink-soft:#b1b6bd;--ink-faint:#838991;--line:#2d323a;--accent:#4cb2a8;--accent-ink:#8fd4cc;--accent-soft:#12332f;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}}
:root[data-theme="dark"]{--paper:#131519;--surface:#1a1d22;--surface-2:#23272e;--ink:#e9e7e0;--ink-soft:#b1b6bd;--ink-faint:#838991;--line:#2d323a;--accent:#4cb2a8;--accent-ink:#8fd4cc;--accent-soft:#12332f;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--jp);line-height:1.7;font-size:16px}
.wrap{max-width:1000px;margin:0 auto;padding:0 24px 100px}
header{border-bottom:2px solid var(--ink);padding:50px 0 20px}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 12px;font-weight:600}
h1{font-size:clamp(1.6rem,1.1rem+2.4vw,2.3rem);margin:0 0 12px;font-weight:800}
.sub{color:var(--ink-soft);max-width:64ch;margin:0}
h2{font-size:1.2rem;margin:34px 0 10px;font-weight:800;padding-bottom:8px;border-bottom:1px solid var(--line)}h2 small{color:var(--ink-faint);font-weight:500;font-size:.8rem}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}@media(max-width:720px){.grid{grid-template-columns:1fr}}
.cand{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)}
.cand img{display:block;width:100%;height:auto;background:#f0ede4}
.cand figcaption{padding:8px 12px;font-size:.85rem;border-top:1px solid var(--line)}
.cand .fn{font-family:var(--mono);font-size:.72rem;color:var(--ink-faint)}
.callout{border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 12px 12px 0;padding:14px 18px;margin:18px 0}
.callout .k{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-ink);font-weight:700;display:block;margin-bottom:5px}
ul{padding-left:1.25em}li{margin:5px 0}li::marker{color:var(--ink-faint)}
.foot{font-size:.82rem;color:var(--ink-faint);margin-top:34px;border-top:1px solid var(--line);padding-top:14px}
</style>
<div class="wrap">
<header>
  <p class="eyebrow">CHARACTER MASTER 候補 — STEP4 選定</p>
  <h1>ハル / ミナ先生の“原本”を1案ずつ選んでください</h1>
  <p class="sub">05のプロンプトで各3案を生成（Gemini画像 / gemini-2.5-flash-image、text-to-image）。選んだ1案を <b>REFERENCE MASTER としてロック</b>し、以降の表情・ポーズ差分はこの原本を参照して作ります（一貫性の基準）。まだ表情差分は作っていません。</p>
</header>

${group('haru', 'ハル（初心者・20-24歳男性・BLUE）', '案1〜3から1つ')}
${group('mina', 'ミナ先生（解説・27-32歳女性・GREEN・眼鏡固定）', '案1〜3から1つ')}

<div class="callout"><span class="k">選ぶときの観点（05準拠）</span>
<ul>
  <li><b>2人が同一作品に見えるか</b>（線・塗り・頭身・陰影が揃う組み合わせ）</li>
  <li>ハル：親しみやすい/素直そう、青パーカー、派手すぎない自然な髪</li>
  <li>ミナ：知的で優しい、細い眼鏡が自然、緑カーデ、偉そうでない</li>
  <li>表情変化を作りやすい素直な顔・正面性・切り抜きやすい背景</li>
  <li>100本使っても飽きない“チャンネルの顔”として妥当か</li>
</ul></div>

<div class="callout"><span class="k">選んだ後の流れ</span>
<p>「ハルは案◯、ミナは案◯」と伝えてください。→ ①その2枚を REFERENCE MASTER としてロック → ②表情差分（ハル7 / ミナ7）とポーズ差分を原本参照で生成（STEP6-7）→ ③見本リールの仮シルエットを本物に差し替え。<br>気に入る案が無ければ、プロンプトを微調整して再生成もできます。</p></div>

<p class="foot">原本フル解像度: <code>poc/character/out/{haru,mina}_master_{1..3}.png</code>（このページの表示は560px縮小）。本番の src・DB は未変更。生成は表現検証用のPoC。</p>
</div>`;

writeFileSync(target, html);
console.log('wrote', target, (html.length / 1024 / 1024).toFixed(2), 'MB');
