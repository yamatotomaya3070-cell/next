// クライアント向け納品パッケージ: 完成見本動画 + 仕様書 + データ を1枚に。
import { readFileSync, writeFileSync } from 'node:fs';

const project = JSON.parse(readFileSync('poc/scene/out/newnisa_project.json', 'utf8'));
const out = process.argv[2] || 'poc/scene/out/delivery.html';
// 動画の埋め込み方: embed=base64(claude用) / relative=同フォルダのmp4参照(納品フォルダ用)
const VIDEO_MODE = process.env.VIDEO_MODE || 'embed';
const VIDEO_SRC = process.env.VIDEO_SRC || 'poc/scene/out/newnisa_video6_web.mp4';
const VIDEO_REL = process.env.VIDEO_REL || '完成見本.mp4';
const videoSrcAttr = VIDEO_MODE === 'relative'
  ? VIDEO_REL
  : `data:video/mp4;base64,${readFileSync(VIDEO_SRC).toString('base64')}`;

const SECTION_JA = { hook: '導入・フック', problem: '問題提起', basics: '基礎説明', example: '具体例', dialogue: '疑問と誤解', caution: '注意点', summary: 'まとめ', cta: '行動喚起' };
const VISUAL_JA = { comparison: '比較図', number_animation: '数字アニメ', chart: 'グラフ', infographic: '概念図', character_conversation: 'キャラ会話', character_explanation: 'キャラ解説', text_emphasis: '強調テロップ', timeline: '年表', process: '手順図', recap: '要点まとめ', generated_video: 'AI生成映像', broll: '実写素材' };
const SPEAKER_JA = { narrator: 'ナレーション', mina: 'ミナ先生', haru: 'ハル' };
const SPK_CLASS = { narrator: 'narr', mina: 'mina', haru: 'haru' };
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// section flow
const flow = [];
project.scenes.forEach((s, i) => {
  const last = flow[flow.length - 1];
  if (last && last.section === s.section) last.nos.push(i + 1);
  else flow.push({ section: s.section, nos: [i + 1] });
});

const assetList = [...new Set(project.scenes.flatMap((s) => s.requiredAsset || []))].sort();
const sourceNotes = project.scenes.map((s, i) => ({ no: i + 1, s: s.source })).filter((x) => x.s);

function sceneCard(s, no) {
  const lines = (s.audio || []).map((a) => `<div class="ln ln--${SPK_CLASS[a.speaker] || 'narr'}"><span class="spk">${SPEAKER_JA[a.speaker] || a.speaker}</span><span class="say">${esc(a.text)}${(a.emphasis || []).length ? ` <em>強調:${esc(a.emphasis.join('・'))}</em>` : ''}</span></div>`).join('');
  const tels = (s.visual.onScreenText || []).map((t) => `<span class="tel">${esc(t)}</span>`).join('');
  return `<article class="scene">
    <div class="sc-head"><span class="no">${String(no).padStart(2, '0')}</span><span class="sec">${SECTION_JA[s.section] || s.section}</span><span class="vt">${VISUAL_JA[s.visual.type] || s.visual.type}</span></div>
    ${s.visual.description ? `<p class="screen"><b>画面</b> ${esc(s.visual.description)}</p>` : ''}
    ${tels ? `<p class="tels"><b>テロップ</b> ${tels}</p>` : ''}
    ${lines ? `<div class="lines">${lines}</div>` : ''}
    ${s.editingInstruction ? `<p class="edit"><b>編集指示</b> ${esc(s.editingInstruction)}</p>` : ''}
    <div class="metas">
      ${(s.requiredAsset || []).length ? `<span class="m"><b>素材</b> ${esc((s.requiredAsset).join(' / '))}</span>` : ''}
      ${(s.qualityCheck || []).length ? `<span class="m"><b>品質</b> ${esc((s.qualityCheck).join(' / '))}</span>` : ''}
      ${s.source ? `<span class="m src"><b>出典要確認</b> ${esc(s.source.ref)}</span>` : ''}
    </div>
  </article>`;
}

const html = `<title>${esc(project.title)} 納品パッケージ</title>
<meta name=viewport content="width=device-width, initial-scale=1">
<style>
:root{--paper:#F5F2EA;--ink:#1B1A16;--soft:#5E594E;--line:#DED8CA;--card:#FCFBF7;--haru:#3F6FA6;--mina:#5E8C4A;--narr:#6B7280;--accent:#2E8F86;--src:#B5762A;--shadow:0 1px 2px rgba(40,35,20,.05),0 8px 24px rgba(40,35,20,.07)}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--paper:#13120F;--ink:#ECE8DE;--soft:#A39C8C;--line:#2C2921;--card:#1C1A15;--haru:#7CA6D8;--mina:#93BE79;--narr:#9AA1AC;--accent:#54C3B8;--src:#D6A45B;--shadow:0 1px 2px rgba(0,0,0,.5),0 8px 24px rgba(0,0,0,.5)}}
:root[data-theme=dark]{--paper:#13120F;--ink:#ECE8DE;--soft:#A39C8C;--line:#2C2921;--card:#1C1A15;--haru:#7CA6D8;--mina:#93BE79;--narr:#9AA1AC;--accent:#54C3B8;--src:#D6A45B;--shadow:0 1px 2px rgba(0,0,0,.5),0 8px 24px rgba(0,0,0,.5)}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);line-height:1.6;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:900px;margin:0 auto;padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,1.5rem)}
.eyebrow{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--soft);margin:0 0 .4rem}
h1{font-size:clamp(1.6rem,3.6vw,2.3rem);font-weight:800;letter-spacing:-.01em;margin:0;text-wrap:balance}
h2{font-size:1.05rem;margin:2.2rem 0 .8rem;padding-bottom:.4rem;border-bottom:2px solid var(--line);display:flex;align-items:center;gap:.5rem}
h2 .n{font-size:.8rem;color:var(--accent);font-weight:800}
video{width:100%;border-radius:12px;border:1px solid var(--line);box-shadow:var(--shadow);background:#000;display:block;margin-top:1rem}
.hint{font-size:.78rem;color:var(--soft);text-align:center;margin:.4rem 0 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-top:.4rem}
@media(max-width:560px){.grid{grid-template-columns:1fr}}
.kv{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:.6rem .8rem}
.kv .k{font-size:.7rem;letter-spacing:.06em;color:var(--soft);text-transform:uppercase}
.kv .v{font-size:.95rem;font-weight:600;margin-top:.1rem}
.kv.wide{grid-column:1/-1}
.flow{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.4rem}
.step{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:.3rem .8rem;font-size:.82rem}
.step b{color:var(--accent);font-variant-numeric:tabular-nums}
.scene{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:.85rem 1rem;margin:.7rem 0;box-shadow:var(--shadow)}
.sc-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
.sc-head .no{font-weight:800;color:var(--soft);font-variant-numeric:tabular-nums}
.sc-head .sec{font-weight:700}
.sc-head .vt{margin-left:auto;font-size:.72rem;border:1px solid var(--line);border-radius:999px;padding:.1rem .55rem;color:var(--accent)}
.scene p{margin:.35rem 0;font-size:.9rem}
.scene b{color:var(--soft);font-weight:700;font-size:.78rem;margin-right:.3rem}
.tel{display:inline-block;background:var(--paper);border:1px dashed var(--line);border-radius:5px;padding:.02rem .4rem;margin-right:.3rem;font-weight:600}
.lines{display:flex;flex-direction:column;gap:.3rem;margin:.4rem 0}
.ln{display:grid;grid-template-columns:76px 1fr;gap:.5rem;align-items:start;font-size:.9rem}
.ln .spk{font-size:.72rem;font-weight:700;padding:.08rem .3rem;border-radius:5px;text-align:center}
.ln--narr .spk{color:var(--narr);border:1px solid var(--narr)}
.ln--haru .spk{color:#fff;background:var(--haru)}
.ln--mina .spk{color:#fff;background:var(--mina)}
.ln em{color:var(--accent);font-style:normal;font-size:.8rem}
.edit{color:var(--ink)}
.metas{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.4rem;font-size:.8rem;color:var(--soft)}
.metas .src{color:var(--src)}
.list{columns:2;gap:1.4rem;font-size:.88rem;color:var(--soft);margin-top:.4rem}
@media(max-width:560px){.list{columns:1}}
.list li{margin:.2rem 0}
.data{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:9px;padding:.8rem 1rem;margin-top:.6rem;font-size:.85rem}
.data code{background:var(--paper);border:1px solid var(--line);border-radius:4px;padding:.05rem .35rem}
footer{margin-top:2.4rem;padding-top:1.2rem;border-top:1px solid var(--line);color:var(--soft);font-size:.8rem}
</style>
<div class=wrap>
<p class=eyebrow>動画制作 · 納品パッケージ（完成見本）</p>
<h1>${esc(project.title)}</h1>

<h2><span class=n>見本</span>完成見本動画</h2>
<video controls playsinline preload=metadata><source src="${videoSrcAttr}" type=video/mp4></video>
<p class=hint>▶ 音が出ます（BGM入り・約5分20秒）</p>

<h2><span class=n>01</span>概要</h2>
<div class=grid>
  <div class="kv"><div class=k>テーマ</div><div class=v>${esc(project.theme)}</div></div>
  <div class="kv"><div class=k>想定視聴者</div><div class=v>${esc(project.audience)}</div></div>
  <div class="kv wide"><div class=k>この動画の目的（結論）</div><div class=v>${esc(project.goal)}</div></div>
  <div class="kv"><div class=k>シーン数</div><div class=v>${project.scenes.length} シーン</div></div>
  <div class="kv"><div class=k>仕様</div><div class=v>1280×720 / 30fps / 16:9 / mp4</div></div>
</div>

<h2><span class=n>02</span>構成の流れ</h2>
<div class=flow>${flow.map((f, i) => `<span class=step><b>${i + 1}</b> ${SECTION_JA[f.section] || f.section}（${f.nos.join('・')}）</span>`).join('')}</div>

<h2><span class=n>03</span>シーン別仕様</h2>
${project.scenes.map((s, i) => sceneCard(s, i + 1)).join('')}

<h2><span class=n>04</span>使用素材リスト</h2>
<ul class=list>${assetList.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>

${sourceNotes.length ? `<h2><span class=n>05</span>出典・確認事項（数値・制度）</h2><ul class=list>${sourceNotes.map((n) => `<li>シーン${n.no}：${esc(n.s.ref)}（一次情報で要確認）</li>`).join('')}</ul>` : ''}

<h2><span class=n>データ</span>添付データ</h2>
<div class=data>この仕様と同じ内容を機械可読データで添付できます：<br>
・<code>scenes.csv</code>（Excelで開けるシーン一覧）<br>
・<code>data.json</code>（構造化データ）<br>
・<code>spec.md</code>（この仕様書のテキスト版）<br>
<span style="color:var(--soft)">※ 実ファイルは制作フォルダ内。このページはクライアント確認用の“見せる面”です。</span></div>

<footer>この動画・仕様・データは<b>テーマ入力からAIが自動生成</b>した見本です。本番は仕様書に沿って就労者が仕上げます（完全ハイブリッド）。数値・制度は出典の一次確認前提。</footer>
</div>`;

writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024 / 1024).toFixed(2), 'MB');
