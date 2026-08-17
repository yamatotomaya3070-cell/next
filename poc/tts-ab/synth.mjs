// TTS ブラインドA/B 合成キット（要APIキー・課金注意）
//   使い方: 環境変数に鍵を入れて `node poc/tts-ab/synth.mjs`
//   鍵のある provider だけ合成し、out/ に音声を書き出し、ブラインド評価用 eval.html を生成する。
//   ※ APIの仕様は変わりうる。各 provider の最新docで body/endpoint を確認すること。
//   ※ 実行すると各 provider に課金される。まず1行だけで試すことを推奨。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'poc/tts-ab/out';
mkdirSync(OUT, { recursive: true });
const { lines } = JSON.parse(readFileSync('poc/tts-ab/lines.json', 'utf8'));

// --- provider アダプタ（鍵が無ければ null を返してスキップ） ---
const providers = {
  // OpenAI gpt-4o-mini-tts : instructions で口調/間/強調を自然言語指示（ナレ第一候補）
  async openai(line) {
    const key = process.env.OPENAI_API_KEY; if (!key) return null;
    const voice = line.kind === 'conversation'
      ? (line.speaker === 'haru' ? (process.env.OPENAI_VOICE_HARU || 'shimmer') : (process.env.OPENAI_VOICE_MINA || 'sage'))
      : (process.env.OPENAI_VOICE_NARR || 'alloy');
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: line.text, instructions: line.instructions_ja, response_format: 'wav' }),
    });
    if (!r.ok) throw new Error('openai ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return { ext: 'wav', buf: Buffer.from(await r.arrayBuffer()) };
  },

  // ElevenLabs : 演技/感情が最上位（会話第一候補）。voice_id を .env で指定。
  async elevenlabs(line) {
    const key = process.env.ELEVENLABS_API_KEY; if (!key) return null;
    const vid = line.kind === 'conversation'
      ? (line.speaker === 'haru' ? process.env.ELEVEN_VOICE_HARU : process.env.ELEVEN_VOICE_MINA)
      : process.env.ELEVEN_VOICE_NARR;
    if (!vid) return null;
    const model = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2'; // v3を使う場合は 'eleven_v3'（要確認）
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
      method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: line.text, model_id: model, voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5 } }),
    });
    if (!r.ok) throw new Error('elevenlabs ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return { ext: 'mp3', buf: Buffer.from(await r.arrayBuffer()) };
  },

  // Gemini 2.5 TTS : 既存キー流用・"声優"寄り。PCMをwavにラップ。
  async gemini(line) {
    const key = process.env.GEMINI_API_KEY; if (!key) return null;
    const voice = process.env.GEMINI_TTS_VOICE || 'Kore';
    const model = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
    const prompt = `${line.instructions_ja}\n---\n${line.text}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
    });
    if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error('gemini: no audio');
    return { ext: 'wav', buf: wrapPcmToWav(Buffer.from(b64, 'base64'), 24000) };
  },

  // VOICEVOX : ローカルHTTP（無料）。VOICEVOX_URL 起動時のみ。
  async voicevox(line) {
    const base = process.env.VOICEVOX_URL; if (!base) return null;
    const spk = line.kind === 'conversation'
      ? (line.speaker === 'haru' ? (process.env.VV_SPK_HARU || '3') : (process.env.VV_SPK_MINA || '2'))
      : (process.env.VV_SPK_NARR || '13');
    const q = await fetch(`${base}/audio_query?speaker=${spk}&text=${encodeURIComponent(line.text)}`, { method: 'POST' });
    if (!q.ok) throw new Error('voicevox query ' + q.status);
    const query = await q.json();
    const s = await fetch(`${base}/synthesis?speaker=${spk}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    if (!s.ok) throw new Error('voicevox synth ' + s.status);
    return { ext: 'wav', buf: Buffer.from(await s.arrayBuffer()) };
  },
};

// --- 実行 ---
const order = ['openai', 'elevenlabs', 'gemini', 'voicevox'];
const manifest = []; // {lineId, provider, file}
for (const line of lines) {
  for (const name of order) {
    try {
      const res = await providers[name](line);
      if (!res) { console.log(`skip ${name} (${line.id}) — 鍵/設定なし`); continue; }
      const file = `${line.id}__${name}.${res.ext}`;
      writeFileSync(`${OUT}/${file}`, res.buf);
      manifest.push({ lineId: line.id, provider: name, file, kind: line.kind });
      console.log(`ok  ${name} ${line.id} -> ${file}`);
    } catch (e) { console.error(`ERR ${name} ${line.id}:`, e.message); }
  }
}

buildEvalSheet(lines, manifest);
console.log('\n完了。ブラインド評価: poc/tts-ab/out/eval.html を開く。正解表: key.json');

// --- ブラインド評価シート（provider名を隠しA/B/C…でランダム提示） ---
function buildEvalSheet(lines, manifest) {
  const key = {};
  const seed = 20260812; let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const crit = ['自然さ', '間', '抑揚', '感情', 'キャラ一貫', '数字/強調', '疲れにくさ'];
  let body = '';
  for (const line of lines) {
    const items = shuffle(manifest.filter(m => m.lineId === line.id));
    key[line.id] = {};
    body += `<section><h2>${line.id} <small>（${line.kind} / ${line.delivery_style}）</small></h2><p class="tx">「${line.text}」</p>`;
    items.forEach((m, i) => {
      const tag = String.fromCharCode(65 + i); key[line.id][tag] = m.provider;
      body += `<div class="cand"><div class="lbl">音声 ${tag}</div><audio controls src="${m.file}"></audio>
        <table><tr>${crit.map(c => `<th>${c}</th>`).join('')}</tr><tr>${crit.map(() => '<td>_ /5</td>').join('')}</tr></table></div>`;
    });
    body += `</section>`;
  }
  const html = `<!doctype html><meta charset="utf-8"><title>TTS ブラインド評価</title><style>body{font-family:"Yu Gothic UI",Meiryo,sans-serif;max-width:820px;margin:0 auto;padding:24px;line-height:1.7}section{border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0}h2 small{color:#888;font-weight:400}.tx{color:#444}.cand{border-top:1px solid #eee;padding:10px 0}.lbl{font-weight:700}audio{width:100%;margin:6px 0}table{border-collapse:collapse;width:100%;font-size:.85rem}th,td{border:1px solid #ddd;padding:6px;text-align:center}</style>
  <h1>TTS ブラインドA/B 評価シート</h1><p>各音声を聞き、1〜5で採点（provider名は伏せてある）。全ライン評価後に key.json で答え合わせ。優先＝自然さ・演技・キャラ一貫。</p>${body}`;
  writeFileSync(`${OUT}/eval.html`, html);
  writeFileSync(`${OUT}/key.json`, JSON.stringify(key, null, 2));
}

// 16bit PCM(mono) を WAV にラップ
function wrapPcmToWav(pcm, rate) {
  const h = Buffer.alloc(44); const dl = pcm.length;
  h.write('RIFF', 0); h.writeUInt32LE(36 + dl, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dl, 40);
  return Buffer.concat([h, pcm]);
}
