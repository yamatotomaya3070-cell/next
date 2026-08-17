// 見本リールの実台本を ElevenLabs で合成（演技/抑揚 最上位候補）。
//   voices_read権限が無いスコープ鍵でも使える「プリメイド声ID」を直接指定。
//   出力: poc/tts-ab/out/reel_eleven/<id>.wav（pcm_24000→wavラップ）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^ELEVENLABS_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}
const KEY = loadKey();
if (!KEY) { console.error('ELEVENLABS_API_KEY が見つかりません。'); process.exit(1); }
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const OUT = 'poc/tts-ab/out/reel_eleven';
mkdirSync(OUT, { recursive: true });

// プリメイド声ID（全アカウント利用可・voices_read不要）。env で上書き可。
const V_NARR = process.env.ELEVEN_VOICE_NARR || 'pNInz6obpgDQGcFmaJgB'; // Adam（落ち着いた男性ナレ）
const V_HARU = process.env.ELEVEN_VOICE_HARU || 'TxGEqnHWrfWFTfGW9XjX'; // Josh（若い男性）
const V_MINA = process.env.ELEVEN_VOICE_MINA || '21m00Tcm4TlvDq8ikWAM'; // Rachel（穏やかな女性）

// stability低め+style高めで抑揚/感情を強める（v2はテキスト指示不可＝設定と句読点で演技）
const SET_NARR = { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };
const SET_CHAR = { stability: 0.3, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true };

const LINES = [
  { id: 'b_narr', voice: V_NARR, set: SET_NARR, text: '毎月1万円。20年後、その差は、約171万円。' },
  { id: 'c_mina', voice: V_MINA, set: SET_CHAR, text: 'NISAなら、利益にかかる税金が、ゼロ円になるの。' },
  { id: 'd_haru', voice: V_HARU, set: SET_CHAR, text: 'ミナ先生、NISAなら絶対に儲かるんですか！？' },
  { id: 'd_mina', voice: V_MINA, set: SET_CHAR, text: 'そこはね、かなり勘違いしやすいポイントなんだよ。' },
  { id: 'e_narr', voice: V_NARR, set: SET_NARR, text: '長い目で見ると、この差が効いてきます。' },
  { id: 'f_mina', voice: V_MINA, set: SET_CHAR, text: 'はじめ方は、たったの3ステップだよ。' },
];

function wrapPcmToWav(pcm, rate) {
  const h = Buffer.alloc(44); const dl = pcm.length;
  h.write('RIFF', 0); h.writeUInt32LE(36 + dl, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dl, 40);
  return Buffer.concat([h, pcm]);
}

async function synth(line) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${line.voice}?output_format=pcm_24000`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/pcm' },
    body: JSON.stringify({ text: line.text, model_id: MODEL, voice_settings: line.set }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error('eleven ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return wrapPcmToWav(Buffer.from(await r.arrayBuffer()), 24000);
}

for (const line of LINES) {
  process.stdout.write(`synth ${line.id} (${line.voice.slice(0, 8)}) ... `);
  for (let a = 1; a <= 3; a++) {
    try { writeFileSync(`${OUT}/${line.id}.wav`, await synth(line)); console.log('ok'); break; }
    catch (e) { if (a === 3) console.error('ERR', e.message); else await new Promise((r) => setTimeout(r, 2 ** a * 1000)); }
  }
}
console.log(`\n出力: ${OUT}/  model=${MODEL}`);
