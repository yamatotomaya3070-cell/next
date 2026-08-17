// 見本リールの実台本を Gemini 2.5 TTS で合成（抑揚重視・"声優寄り"）。
//   話者ごとに別プリセット声＋強い演技/抑揚のスタイル指示。既存GEMINI_API_KEY流用（無料）。
//   出力: poc/tts-ab/out/reel_gemini/<id>.wav
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}
const KEY = loadKey();
if (!KEY) { console.error('GEMINI_API_KEY が見つかりません。'); process.exit(1); }
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const OUT = 'poc/tts-ab/out/reel_gemini';
mkdirSync(OUT, { recursive: true });

// 話者→プリセット声（Gemini prebuilt）。ナレ=Charon(落ち着き)/ハル=Puck(若く快活)/ミナ=Kore(温かい)
const LINES = [
  { id: 'b_narr', voice: 'Charon', style: '金融解説の落ち着いたナレーション。期待感をにじませ、数字「約171万円」は驚きが伝わるようはっきり強調し、抑揚をしっかりつけて。', text: '毎月1万円。20年後、その差は、約171万円。' },
  { id: 'c_mina', voice: 'Kore', style: '優しい女性の先生が、うれしい発見を教えるように、明るく抑揚をつけて、笑顔が伝わる声で。', text: 'NISAなら、利益にかかる税金が、ゼロ円になるの。' },
  { id: 'd_haru', voice: 'Puck', style: '20代前半の初心者の若者が、目を輝かせて食い気味に、わくわくして興奮気味に質問する。抑揚は大きめ、語尾は弾ませて。', text: 'ミナ先生、NISAなら絶対に儲かるんですか！？' },
  { id: 'd_mina', voice: 'Kore', style: '優しく諭すように。大事なポイントなので少しトーンを落として、ゆっくり丁寧に、抑揚をつけて。', text: 'そこはね、かなり勘違いしやすいポイントなんだよ。' },
  { id: 'e_narr', voice: 'Charon', style: '納得感を込めて、しみじみと、抑揚をつけて落ち着いて。', text: '長い目で見ると、この差が効いてきます。' },
  { id: 'f_mina', voice: 'Kore', style: '明るく背中を押すように、前向きで元気な笑顔の声で、抑揚をつけて。', text: 'はじめ方は、たったの3ステップだよ。' },
];

function wrapPcmToWav(pcm, rate) {
  const h = Buffer.alloc(44); const dl = pcm.length;
  h.write('RIFF', 0); h.writeUInt32LE(36 + dl, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dl, 40);
  return Buffer.concat([h, pcm]);
}

async function synth(line) {
  const prompt = `${line.style}\n---\n${line.text}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: line.voice } } } },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error('no audio');
  return wrapPcmToWav(Buffer.from(b64, 'base64'), 24000);
}

for (const line of LINES) {
  process.stdout.write(`synth ${line.id} (${line.voice}) ... `);
  for (let a = 1; a <= 3; a++) {
    try { writeFileSync(`${OUT}/${line.id}.wav`, await synth(line)); console.log('ok'); break; }
    catch (e) { if (a === 3) console.error('ERR', e.message); else await new Promise((r) => setTimeout(r, 2 ** a * 1000)); }
  }
}
console.log(`\n出力: ${OUT}/`);
