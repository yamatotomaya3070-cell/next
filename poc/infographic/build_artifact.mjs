// 実レンダリング結果(reel.mp4 + 5 stills + SCENE JSON)を埋め込んだ閲覧用HTMLを生成。
import { readFileSync, writeFileSync } from 'node:fs';
import { scene041 } from './scenes.mjs';

const OUT = 'poc/infographic/out';
const b64 = (p) => readFileSync(p).toString('base64');
const mp4 = b64(`${OUT}/reel.mp4`);
const stills = {
  s41: b64(`${OUT}/scene_041_still.png`),
  s46: b64(`${OUT}/scene_046_still.png`),
  s24: b64(`${OUT}/scene_024_still.png`),
  s70: b64(`${OUT}/scene_070_still.png`),
  s02: b64(`${OUT}/scene_002_still.png`),
};
const json41 = JSON.stringify(scene041, null, 2);
const target = process.argv[2] || 'poc_artifact.html';
const eh = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fig = (b, cap) => `<figure><img src="data:image/png;base64,${b}" alt="">\n<figcaption>${cap}</figcaption></figure>`;

const html = `<title>図解レンダPoC — SCENEデータ→mp4</title>
<style>
:root{--paper:#f5f4ef;--surface:#fffefb;--surface-2:#ecebe3;--ink:#1b1f24;--ink-soft:#4a4f57;--ink-faint:#7d838c;--line:#dad7cd;--accent:#1f6f6b;--accent-ink:#114b48;--accent-soft:#d9e8e6;--good:#2e7d5b;--shadow:0 1px 2px rgba(20,22,26,.05),0 6px 24px rgba(20,22,26,.06);--mono:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;--jp:"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP",Meiryo,sans-serif;}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#131519;--surface:#1a1d22;--surface-2:#23272e;--ink:#e9e7e0;--ink-soft:#b1b6bd;--ink-faint:#838991;--line:#2d323a;--accent:#4cb2a8;--accent-ink:#8fd4cc;--accent-soft:#12332f;--good:#4bab7f;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}}
:root[data-theme="dark"]{--paper:#131519;--surface:#1a1d22;--surface-2:#23272e;--ink:#e9e7e0;--ink-soft:#b1b6bd;--ink-faint:#838991;--line:#2d323a;--accent:#4cb2a8;--accent-ink:#8fd4cc;--accent-soft:#12332f;--good:#4bab7f;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}
*{box-sizing:border-box;}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--jp);line-height:1.72;font-size:16px;-webkit-font-smoothing:antialiased;}
.wrap{max-width:920px;margin:0 auto;padding:0 24px 100px;}
header{border-bottom:2px solid var(--ink);padding:52px 0 22px;}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 12px;font-weight:600;}
h1{font-size:clamp(1.7rem,1.1rem+2.6vw,2.5rem);line-height:1.14;margin:0 0 14px;font-weight:800;text-wrap:balance;}
.sub{color:var(--ink-soft);max-width:64ch;margin:0;}
h2{font-size:1.25rem;margin:40px 0 10px;font-weight:800;padding-bottom:10px;border-bottom:1px solid var(--line);}
p{margin:11px 0;}code{font-family:var(--mono);font-size:.85em;background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:.06em .4em;}
figure{margin:16px 0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shadow);}
figure video,figure img{display:block;width:100%;height:auto;background:#0e1a1e;}
figcaption{padding:10px 16px;font-size:.85rem;color:var(--ink-faint);border-top:1px solid var(--line);}
.tag{display:inline-block;font-family:var(--mono);font-size:.72rem;font-weight:700;color:#fff;background:var(--accent);padding:2px 9px;border-radius:6px;margin-right:6px;}
.callout{border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 12px 12px 0;padding:14px 18px;margin:18px 0;}
.callout .k{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-ink);font-weight:700;display:block;margin-bottom:5px;}
ul{padding-left:1.25em;}li{margin:5px 0;}li::marker{color:var(--ink-faint);}
.chk li{list-style:none;position:relative;padding-left:26px;}.chk li::before{content:"✓";position:absolute;left:0;color:var(--good);font-weight:800;}
pre{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow);font-family:var(--mono);font-size:.78rem;line-height:1.55;}
.path{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-family:var(--mono);font-size:.82rem;margin:14px 0;}
.path .n{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:6px 12px;box-shadow:var(--shadow);}
.path .n.hl{border-color:var(--accent);color:var(--accent-ink);}.path .a{color:var(--ink-faint);}
.foot{font-size:.82rem;color:var(--ink-faint);margin-top:36px;border-top:1px solid var(--line);padding-top:14px;}
</style>
<div class="wrap">
<header>
  <p class="eyebrow">図解レンダ PoC — 実描画・実mp4 / 5 visual_type</p>
  <h1>SCENEデータ → SVG → PNG → mp4 が通った（図解5種）</h1>
  <p class="sub">P0最大の未知数「金融図解を構造化データから描けるか」を実機で検証。下の動画・静止画は AIが生成する <code>SCENE.visual.infographic</code> のJSONから、本番想定と同じ <code>SVG → sharp(PNG) → ffmpeg(mp4)</code> 経路で実際にレンダリングした出力。手描きモックではない。<strong>comparison / number_animation / chart / timeline / process</strong> の5タイプを公開品質で描画（1280×720 / 30fps / 30秒 / 約0.75MB）。</p>
</header>

<h2>レンダリング結果（5シーン連結 reel.mp4）</h2>
<figure>
  <video controls loop muted playsinline poster="data:image/png;base64,${stills.s41}">
    <source src="data:video/mp4;base64,${mp4}" type="video/mp4">
  </video>
  <figcaption>comparison → chart → timeline → process → number_animation。順次出現・強調pop・グロー・線の描画・カウントアップを実装。※再生されない場合は下の静止画（同じ出力の1フレーム）を参照。</figcaption>
</figure>

<h2>各 visual_type の1フレーム（実出力）</h2>
${fig(stills.s41, '<span class="tag">comparison</span> scene_041 — 通常口座 vs NISA。税金「0円」を最後に1.4倍＋グローで強調（ルーブリック F・E）。')}
${fig(stills.s46, '<span class="tag">chart</span> scene_046 — 積立20年の資産推移。元本 vs 運用5%の複利を左→右に描画、終端に約413万円/240万円のコールアウト。')}
${fig(stills.s24, '<span class="tag">timeline</span> scene_024 — NISA制度の変遷。2024（新NISA）をグロー＋拡大で強調。')}
${fig(stills.s70, '<span class="tag">process</span> scene_070 — 口座開設3ステップ。番号バッジ・チェック・矢印で手順を順次点灯。')}
${fig(stills.s02, '<span class="tag">number_animation</span> scene_002 — 差額のカウントアップ。フレーム幅に自動フィット、リスク注記付き（ルーブリック K 安全ゲート）。')}

<h2>これはデータ駆動である（scene_041 の入力JSON）</h2>
<p>各図解は<strong>構造化データ1つ</strong>から生成される。これがそのまま「AIが生成するシーン設計図」＝ <code>SCENE.visual.infographic</code> の入力になる。文言・数値・強調・出現タイミングはすべてデータ側にあり、描画コードは visual_type ごとに汎用。</p>
<pre>${eh(json41)}</pre>

<h2>本番への接続</h2>
<div class="path">
  <span class="n hl">SCENE.visual.infographic (JSON)</span><span class="a">→</span>
  <span class="n">SVG生成（type別・データ駆動）</span><span class="a">→</span>
  <span class="n hl">sharp で PNG</span><span class="a">→</span>
  <span class="n hl">ffmpeg で mp4</span><span class="a">→</span>
  <span class="n">既存 pipeline で合成・連結</span>
</div>
<p>網掛けの3つは<strong>既にこのプロジェクトに存在する</strong>（<code>sharp</code>=devDependency、<code>ffmpeg</code>=ワーカー環境、<code>scripts/video/exec.ts</code>のラッパ）。図解レンダは<strong>新基盤不要、既存経路に「SVG生成層」を足すだけ</strong>で成立する。</p>

<h2>何が検証できたか</h2>
<ul class="chk">
  <li>構造化データから<strong>公開品質の金融図解を5タイプ</strong>描ける（comparison / number / chart / timeline / process）</li>
  <li>sharp(librsvg)が<strong>日本語グリフを正しくラスタライズ</strong>（当初の懸念を解消）</li>
  <li>順次出現・強調pop・グロー・線の描画アニメ・カウントアップなど<strong>アニメーション可能</strong>（ルーブリック D・F）</li>
  <li>「0円」「2024」を最後に強調＝<strong>ナレの結論と映像の一致</strong>（ルーブリック E）</li>
  <li>出典・リスク注記をデータで保持（ルーブリック K 安全ゲート）</li>
  <li>出力は<strong>既存のffmpeg経路に乗る</strong>実mp4（新基盤不要）</li>
</ul>

<div class="callout"><span class="k">残る未知数</span>
<p>① SEを sync_target で数字・強調に同期（このPoCは無音）② 立ち絵・背景・字幕との合成レイヤ ③ AIが出力する infographic JSON の妥当性（値の整合・強調の妥当性）④ 音声(TTS)の provider確定（別キット poc/tts-ab、要APIキー）。①②は本PoCの延長で低リスク、③④はP1で対応。</p></div>

<p class="foot">PoCコード: <code>poc/infographic/</code>（shared / comparison / number / chart / timeline / process / scenes / render / build_artifact）。本番の src・scripts・DB・migration は未変更。数値（税率20.315%・差額171万円・利回り5%・413万円）は表現検証用の例で、実制作時は出典管理（source: ref/confirmed_date/fiscal_year）で一次情報と紐付ける前提。720p・無音はPoC簡略化。</p>
</div>`;

writeFileSync(target, html);
console.log('wrote', target, (html.length / 1024 / 1024).toFixed(2), 'MB');
