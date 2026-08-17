// 見本リールの実台本を OpenAI gpt-4o-mini-tts で合成（ナレ/ハル/ミナ 3声）。
//   鍵は process.env.OPENAI_API_KEY か .env.local から読む（読むだけ・表示しない）。
//   出力: poc/tts-ab/out/reel/<id>.wav
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^OPENAI_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}
const KEY = loadKey();
if (!KEY) { console.error('OPENAI_API_KEY が見つかりません。'); process.exit(1); }

const OUT = 'poc/tts-ab/out/reel';
mkdirSync(OUT, { recursive: true });

const NARR = 'あなたは金融解説YouTubeの落ち着いたナレーター。丁寧でわかりやすく、数字は明瞭に、要所で軽く間をとる。過剰に感情を込めない。';
const HARU = 'あなたは20代前半の初心者の男性「ハル」。素朴で人懐っこい。ここは驚いて少し食い気味に、期待をこめて質問する。';
const MINA = 'あなたは30歳前後の優しい女性の先生「ミナ」。安心感があり、ゆっくり丁寧に、笑顔が伝わる柔らかい口調で諭すように話す。';

// 見本リールの実台本（mock_render.mjs と一致）
const LINES = [
  { id: 'b_narr', voice: 'alloy', instr: NARR, text: '毎月1万円。20年後、その差は、約171万円。' },
  { id: 'c_mina', voice: 'sage', instr: MINA, text: 'NISAなら、利益にかかる税金が、ゼロ円になるの。' },
  { id: 'd_haru', voice: 'ash', instr: HARU, text: 'ミナ先生、NISAなら絶対に儲かるんですか！？' },
  { id: 'd_mina', voice: 'sage', instr: MINA, text: 'そこは、かなり勘違いしやすいポイントだよ。' },
  { id: 'e_narr', voice: 'alloy', instr: NARR, text: '長い目で見ると、この差が効いてきます。' },
  { id: 'f_mina', voice: 'sage', instr: MINA, text: 'はじめ方は、たったの3ステップだよ。' },
];

async function synth(line) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: line.voice, input: line.text, instructions: line.instr, response_format: 'wav' }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error('openai ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

for (const line of LINES) {
  process.stdout.write(`synth ${line.id} (${line.voice}) ... `);
  try {
    const buf = await synth(line);
    writeFileSync(`${OUT}/${line.id}.wav`, buf);
    console.log(`ok ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (e) { console.error('ERR', e.message); }
}
console.log(`\n出力: ${OUT}/`);
