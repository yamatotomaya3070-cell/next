// 見本リール(mock_reel.mp4)を埋め込んだ「どんな動画になるか」閲覧HTMLを生成。
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = 'poc/infographic/out';
const b64 = (p) => readFileSync(p).toString('base64');
const mp4 = b64(`${OUT}/mock_reel.mp4`);
const conv = b64(`${OUT}/mock_conv_still.png`);
const cmp = b64(`${OUT}/mock_cmp_still.png`);
const target = process.argv[2] || 'mock.html';
const fig = (b, cap) => `<figure><img src="data:image/png;base64,${b}" alt="">\n<figcaption>${cap}</figcaption></figure>`;

const html = `<title>どんな動画になるか — 見本リール</title>
<style>
:root{--paper:#f5f4ef;--surface:#fffefb;--surface-2:#ecebe3;--ink:#1b1f24;--ink-soft:#4a4f57;--ink-faint:#7d838c;--line:#dad7cd;--accent:#1f6f6b;--accent-ink:#114b48;--accent-soft:#d9e8e6;--good:#2e7d5b;--warn:#a9711a;--shadow:0 1px 2px rgba(20,22,26,.05),0 6px 24px rgba(20,22,26,.06);--mono:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;--jp:"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP",Meiryo,sans-serif;}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#131519;--surface:#1a1d22;--surface-2:#23272e;--ink:#e9e7e0;--ink-soft:#b1b6bd;--ink-faint:#838991;--line:#2d323a;--accent:#4cb2a8;--accent-ink:#8fd4cc;--accent-soft:#12332f;--good:#4bab7f;--warn:#d19a3f;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}}
:root[data-theme="dark"]{--paper:#131519;--surface:#1a1d22;--surface-2:#23272e;--ink:#e9e7e0;--ink-soft:#b1b6bd;--ink-faint:#838991;--line:#2d323a;--accent:#4cb2a8;--accent-ink:#8fd4cc;--accent-soft:#12332f;--good:#4bab7f;--warn:#d19a3f;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}
*{box-sizing:border-box;}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--jp);line-height:1.72;font-size:16px;-webkit-font-smoothing:antialiased;}
.wrap{max-width:920px;margin:0 auto;padding:0 24px 100px;}
header{border-bottom:2px solid var(--ink);padding:52px 0 22px;}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 12px;font-weight:600;}
h1{font-size:clamp(1.7rem,1.1rem+2.6vw,2.5rem);line-height:1.14;margin:0 0 14px;font-weight:800;text-wrap:balance;}
.sub{color:var(--ink-soft);max-width:64ch;margin:0;}
h2{font-size:1.25rem;margin:38px 0 10px;font-weight:800;padding-bottom:10px;border-bottom:1px solid var(--line);}
p{margin:11px 0;}code{font-family:var(--mono);font-size:.85em;background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:.06em .4em;}
figure{margin:16px 0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shadow);}
figure video,figure img{display:block;width:100%;height:auto;background:#0e1a1e;}
figcaption{padding:10px 16px;font-size:.85rem;color:var(--ink-faint);border-top:1px solid var(--line);}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0;}@media(max-width:720px){.cols{grid-template-columns:1fr;}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 18px;box-shadow:var(--shadow);}
.card.real{border-top:3px solid var(--good);}.card.ph{border-top:3px solid var(--warn);}
.card h3{margin:2px 0 8px;font-size:1rem;}
ul{padding-left:1.25em;margin:8px 0;}li{margin:5px 0;}li::marker{color:var(--ink-faint);}
.seq{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0;font-family:var(--mono);font-size:.78rem;}
.seq span{background:var(--surface);border:1px solid var(--line);border-radius:7px;padding:5px 10px;box-shadow:var(--shadow);}
.seq .a{color:var(--ink-faint);align-self:center;}
.callout{border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 12px 12px 0;padding:14px 18px;margin:18px 0;}
.callout .k{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-ink);font-weight:700;display:block;margin-bottom:5px;}
.foot{font-size:.82rem;color:var(--ink-faint);margin-top:36px;border-top:1px solid var(--line);padding-top:14px;}
</style>
<div class="wrap">
<header>
  <p class="eyebrow">見本リール — 実描画・37秒・無音</p>
  <h1>いまの設計だと、動画はこうなる</h1>
  <p class="sub">「新NISAって結局何？」の抜粋を、これまでの設計（04の完成動画設計・05のキャラ設計）どおりに<strong>実際にレンダリング</strong>した見本。タイトル → 図解 → キャラ会話 → 図解 → まとめ、という1本の解説動画の流れを、<code>SVG → sharp → ffmpeg</code> で合成している。<strong>音声は無し・キャラ立ち絵は仮のシルエット</strong>（ハル/ミナのMASTER画像はこれから生成）。</p>
</header>

<h2>見本リール（mock_reel.mp4 / 37秒）</h2>
<figure>
  <video controls loop muted playsinline poster="data:image/png;base64,${cmp}">
    <source src="data:video/mp4;base64,${mp4}" type="video/mp4">
  </video>
  <figcaption>タイトル→フック(差額)→比較(税金0円)→会話(疑問と誤解)→資産推移→3ステップ→まとめ。字幕は話者で色分け（ナレ=灰／ハル=青／ミナ=緑）。※再生されない場合は下の静止画を参照。</figcaption>
</figure>
<div class="seq">
  <span>タイトル</span><span class="a">→</span><span>フック number</span><span class="a">→</span><span>comparison</span><span class="a">→</span><span>会話</span><span class="a">→</span><span>chart</span><span class="a">→</span><span>process</span><span class="a">→</span><span>まとめ</span>
</div>

<h2>1フレーム（実出力）</h2>
${fig(conv, '会話ビート（疑問と誤解）：仮シルエットのハル(青・減光)⇄ミナ(緑・点灯)、テロップ「NISA＝元本保証ではない」、話者色分け字幕、左上セクション。話者交互の減光まで合成。')}
${fig(cmp, '図解＋字幕：comparison(税金0円)の上に、ミナ先生の字幕を重ねた合成。数字の核は図解、語りは字幕で二重に伝える。')}

<h2>何が「本物」で、何が「仮」か</h2>
<div class="cols">
  <div class="card real"><h3>✅ 実描画（この設計で確定）</h3><ul>
    <li>図解5種：comparison / number / chart / timeline / process</li>
    <li>字幕（話者色分け）・強調テロップ・セクション表示</li>
    <li>会話の話者切替と非話者の減光</li>
    <li>タイトル／まとめ（合言葉）カード</li>
    <li>すべて構造化データ→SVG→ffmpegの実mp4</li>
  </ul></div>
  <div class="card ph"><h3>⏳ 仮（これから差し替え）</h3><ul>
    <li>キャラ立ち絵＝青/緑のシルエット → <strong>05のハル/ミナ MASTER画像</strong>を生成・承認して差替（要 GEMINI_API_KEY）</li>
    <li>音声＝無し → <strong>TTS実機A/B</strong>で確定（poc/tts-ab、ハル=男性/ミナ=女性）</li>
    <li>口パク・簡易モーション・i2v（重要リアクション）は P1</li>
  </ul></div>
</div>

<div class="callout"><span class="k">つまり</span>
<p><strong>動画の「見え方（映像言語）」はこの設計で成立している</strong>——図解が主役で数字を語り、キャラが疑問を代弁し、字幕とテロップで二重に伝え、章ごとに切り替わる。残っているのは <strong>①本物のハル/ミナ ②声</strong> の2点だけ。この2つが乗れば、そのまま公開品質の10分動画になる。図解:キャラ:数字の比率も設計どおり。</p></div>

<p class="foot">PoCコード: <code>poc/infographic/</code>（overlay/conversation/title/mock_render 等）。本番の src・scripts・DB・migration は未変更。数値（差額171万円・利回り5%・税率20.315%）は表現検証用の例で、実制作時は出典管理で一次情報と紐付ける。720p・無音・仮キャラはPoC簡略化。</p>
</div>`;

writeFileSync(target, html);
console.log('wrote', target, (html.length / 1024 / 1024).toFixed(2), 'MB');
