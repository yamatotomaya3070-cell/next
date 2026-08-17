// 生成した VideoProject を「設計図(絵コンテ)」HTMLに起こす。P0成果物②のレビュー用。
import { readFileSync, writeFileSync } from "node:fs";

const project = JSON.parse(readFileSync("poc/scene/out/newnisa_project.json", "utf8"));
const report = JSON.parse(readFileSync("poc/scene/out/newnisa_report.json", "utf8"));
const out = process.argv[2] || "poc/scene/out/storyboard.html";

const SECTION_JA = { hook: "フック", problem: "問題提起", basics: "基礎説明", example: "具体例", dialogue: "対話", caution: "注意点", summary: "まとめ", cta: "行動喚起" };
const SPK = { narrator: ["ナレ", "narr"], mina: ["ミナ先生", "mina"], haru: ["ハル", "haru"] };
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function highlight(text, emphasis) {
  let html = esc(text);
  for (const e of (emphasis || []).filter(Boolean)) {
    html = html.split(esc(e)).join(`<mark>${esc(e)}</mark>`);
  }
  return html;
}

function infoBadge(info) {
  if (!info) return "";
  const map = { comparison: "比較図", number_animation: "数字アニメ", chart: "グラフ", timeline: "年表", process: "手順図" };
  return `<span class="chip chip--info">▣ ${map[info.kind] || info.kind}</span>`;
}

function audioRow(a) {
  const [name, key] = SPK[a.speaker] || [a.speaker, "narr"];
  const meta = [a.emotion, a.deliveryStyle, `強さ${a.emotionIntensity}`, a.speakingRate].join(" · ");
  const pause = (a.pauseBefore !== "none" || a.pauseAfter !== "none") ? `<span class="pause">間 前:${a.pauseBefore}/後:${a.pauseAfter}</span>` : "";
  return `<div class="line line--${key}">
    <div class="spk">${name}</div>
    <div class="say"><p class="text">${highlight(a.text, a.emphasis)}</p>
      <div class="ameta">${esc(meta)} ${pause}${a.syncTarget ? `<span class="sync">⇢ ${esc(a.syncTarget)}</span>` : ""}</div></div>
  </div>`;
}

function sceneCard(s, n) {
  const secJa = SECTION_JA[s.section] || s.section;
  const telop = (s.visual.onScreenText || []).map((t) => `<span class="telop">${esc(t)}</span>`).join("");
  const se = (s.se || []).map((x) => `<span class="chip chip--se">♪ ${esc(x.cue)}</span>`).join("");
  return `<article class="scene" data-sec="${s.section}">
    <div class="scene__head">
      <span class="num">${String(n).padStart(2, "0")}</span>
      <span class="sec">${secJa}</span>
      <span class="chip chip--vis">${esc(s.visual.type)}</span>${infoBadge(s.visual.infographic)}
      <span class="id">${esc(s.id)}</span>
    </div>
    <p class="desc">${esc(s.visual.description)}</p>
    ${telop ? `<div class="telops">テロップ: ${telop}</div>` : ""}
    <div class="lines">${(s.audio || []).map(audioRow).join("")}</div>
    <div class="scene__foot">
      ${se}
      ${s.bgm?.action && s.bgm.action !== "continue" ? `<span class="chip">BGM ${esc(s.bgm.action)}</span>` : ""}
      ${s.source ? `<span class="chip chip--src">出典要確認</span>` : ""}
    </div>
    ${s.editingInstruction ? `<p class="edit">✎ ${esc(s.editingInstruction)}</p>` : ""}
  </article>`;
}

const cards = project.scenes.map((s, i) => sceneCard(s, i + 1)).join("");

const html = `<title>新NISA 動画設計図</title>
<meta name=viewport content="width=device-width, initial-scale=1">
<style>
:root{
  --paper:#F5F2EA;--ink:#1B1A16;--soft:#5E594E;--line:#DED8CA;--card:#FCFBF7;
  --narr:#6B7280;--haru:#3F6FA6;--mina:#5E8C4A;--mark:#FBE7A1;--src:#B5762A;
  --hook:#C2683B;--problem:#B08A2E;--basics:#3F6FA6;--example:#2F8F86;--dialogue:#7C5AB0;--caution:#C24E4E;--summary:#5E8C4A;--cta:#C2683B;
  --shadow:0 1px 2px rgba(40,35,20,.05),0 6px 20px rgba(40,35,20,.06);
}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){
  --paper:#13120F;--ink:#ECE8DE;--soft:#A39C8C;--line:#2C2921;--card:#1C1A15;
  --narr:#9AA1AC;--haru:#7CA6D8;--mina:#93BE79;--mark:#5c4d1f;--src:#D6A45B;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 6px 20px rgba(0,0,0,.5);
}}
:root[data-theme=dark]{
  --paper:#13120F;--ink:#ECE8DE;--soft:#A39C8C;--line:#2C2921;--card:#1C1A15;
  --narr:#9AA1AC;--haru:#7CA6D8;--mina:#93BE79;--mark:#5c4d1f;--src:#D6A45B;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 6px 20px rgba(0,0,0,.5);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);line-height:1.6;
  font-family:"Hiragino Kaku Gothic ProN","Yu Gothic UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,1.5rem)}
.eyebrow{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--soft);margin:0 0 .4rem}
h1{font-size:clamp(1.6rem,3.6vw,2.3rem);font-weight:800;letter-spacing:-.01em;margin:0;text-wrap:balance}
.goal{color:var(--soft);margin:.6rem 0 0;max-width:64ch}
.summary{display:flex;flex-wrap:wrap;gap:.5rem;margin:1.2rem 0 .4rem}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.5rem .8rem;font-size:.8rem;color:var(--soft)}
.stat b{color:var(--ink);font-size:1.05rem;font-variant-numeric:tabular-nums;display:block}
.flow{font-size:.8rem;color:var(--soft);margin:.6rem 0 0}
.flow b{color:var(--ink)}
.legend{display:flex;gap:.8rem;flex-wrap:wrap;margin:1.4rem 0 .6rem;font-size:.75rem;color:var(--soft)}
.legend span{display:inline-flex;align-items:center;gap:.35rem}
.dot{width:.7rem;height:.7rem;border-radius:50%}
.scene{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:12px;padding:1rem 1.1rem;margin:.9rem 0;box-shadow:var(--shadow)}
${Object.keys(SECTION_JA).map((k) => `.scene[data-sec=${k}]{border-left-color:var(--${k})}`).join("")}
.scene__head{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.num{font-variant-numeric:tabular-nums;font-weight:800;color:var(--soft);font-size:.9rem}
.sec{font-weight:700;font-size:.9rem}
${Object.keys(SECTION_JA).map((k) => `.scene[data-sec=${k}] .sec{color:var(--${k})}`).join("")}
.id{margin-left:auto;font-size:.7rem;color:var(--soft);font-variant-numeric:tabular-nums}
.chip{font-size:.7rem;padding:.12rem .5rem;border:1px solid var(--line);border-radius:999px;color:var(--soft);white-space:nowrap}
.chip--vis{background:var(--paper);color:var(--ink);font-weight:600}
.chip--info{border-color:var(--basics);color:var(--basics)}
.chip--se{border-color:var(--dialogue);color:var(--dialogue)}
.chip--src{border-color:var(--src);color:var(--src)}
.desc{margin:.6rem 0 .5rem;font-size:.92rem}
.telops{font-size:.78rem;color:var(--soft);margin:.2rem 0 .6rem}
.telop{display:inline-block;background:var(--paper);border:1px dashed var(--line);border-radius:6px;padding:.05rem .45rem;margin:.1rem .2rem .1rem 0;color:var(--ink);font-weight:600}
.lines{display:flex;flex-direction:column;gap:.5rem;margin:.4rem 0}
.line{display:grid;grid-template-columns:64px 1fr;gap:.6rem;align-items:start}
.spk{font-size:.72rem;font-weight:700;padding:.15rem .3rem;border-radius:6px;text-align:center;align-self:start;margin-top:.15rem}
.line--narr .spk{color:var(--narr);border:1px solid var(--narr)}
.line--haru .spk{color:#fff;background:var(--haru)}
.line--mina .spk{color:#fff;background:var(--mina)}
.text{margin:0;font-size:.95rem}
.text mark{background:var(--mark);color:inherit;padding:0 .12em;border-radius:3px;font-weight:700}
.ameta{font-size:.7rem;color:var(--soft);margin-top:.15rem}
.pause,.sync{margin-left:.4rem}
.sync{color:var(--dialogue)}
.scene__foot{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem}
.edit{font-size:.78rem;color:var(--soft);margin:.6rem 0 0;padding-top:.5rem;border-top:1px dashed var(--line)}
footer{margin-top:2rem;padding-top:1.2rem;border-top:1px solid var(--line);color:var(--soft);font-size:.8rem}
footer b{color:var(--ink)}
</style>
<div class=wrap>
<p class=eyebrow>再設計P0 · AI生成の動画設計図（PROJECT→SCENE）</p>
<h1>${esc(project.title)}</h1>
<p class=goal>${esc(project.goal)}</p>
<div class=summary>
  <div class=stat><b>${report.sceneCount}</b>シーン</div>
  <div class=stat><b>${SECTION_JA[project.scenes[0]?.section] ? report.sections.length : report.sections.length}</b>/8 section</div>
  <div class=stat><b>約${(report.estimatedSec/60).toFixed(1)}</b>分(推定)</div>
  <div class=stat><b>${esc(project.audience)}</b>向け</div>
  <div class=stat><b>${report.ok ? "OK" : "要修正"}</b>検証</div>
</div>
<p class=flow><b>構成:</b> ${report.sections.map((s) => SECTION_JA[s] || s).join(" → ")}</p>
<div class=legend>
  <span><span class="dot" style="background:var(--narr)"></span>ナレ</span>
  <span><span class="dot" style="background:var(--haru)"></span>ハル(初心者)</span>
  <span><span class="dot" style="background:var(--mina)"></span>ミナ先生(解説)</span>
  <span><mark>強調語</mark></span>
  <span>▣ 図解データ有</span>
</div>
${cards}
<footer>この設計図は<b>テーマ入力からAI(Gemini)が自動生成</b>し、SCENE schemaで正規化・検証したもの。就労者はこの設計図＋完成見本に沿って本番を仕上げる（完全ハイブリッド）。数値・制度は<b>出典要確認(K項目)</b>で裏取り前提。poc/隔離・本番未配線。</footer>
</div>`;

writeFileSync(out, html);
console.log("wrote", out, (html.length / 1024).toFixed(0), "KB");
