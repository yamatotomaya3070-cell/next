// STEP6: 表情差分生成（image-to-image / ロック済みMASTERを参照）。05 §8 準拠。
//   ロック原本 locked/{id}_MASTER.png を inline_data で参照し「顔の表情だけ」を変える。
//   鍵は process.env.GEMINI_API_KEY か .env.local から読む（読むだけ・表示しない）。
//   src/lib/image-gen/gemini.ts と同じ形（gemini-2.5-flash-image / responseModalities:["IMAGE"]）。
//   ※ 実行するとGemini画像APIに課金（既定14回：ハル7＋ミナ7）。生成物は out/expr/ に保存。
//   使い方: node gen_expressions.mjs [haru|mina]   （引数省略で両方）
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const f of ['../../.env.local', '../../.env', '.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const API_KEY = loadKey();
if (!API_KEY) {
  console.error('GEMINI_API_KEY が見つかりません。環境変数か .env.local に設定してください。');
  process.exit(1);
}
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OUT = 'out/expr';
mkdirSync(OUT, { recursive: true });

const NEGATIVE = `AVOID: different person, different face, different hairstyle, different hair color, different eye color, different clothes, different age, different body type, different glasses, different proportions, different art style, photorealistic, 3D render, chibi, childlike, VTuber costume, fantasy clothing, excessive accessories, logo, text, watermark, busy background, extreme perspective, dramatic lighting, overly detailed, extra fingers, malformed hands, duplicate character.`;

// 05 §8 共通テンプレ。{GLASSES} はミナのみ ", glasses" を差し込む。
function exprPrompt(desc, glasses) {
  return `Using the reference image as the EXACT same character, change ONLY the facial expression to: ${desc}.
Keep identical: face, outline, eyes, eye color, nose, hairstyle, hair color, age, body, proportions, outfit, outfit color${glasses ? ', glasses' : ''}, art style, line weight, head count. Same framing (waist-up), same view. Plain solid light background, no text.
${NEGATIVE}`;
}

// 05 §8 表情セット
const SETS = {
  haru: {
    master: 'locked/haru_MASTER.png',
    glasses: false,
    expressions: [
      ['neutral', 'a normal calm face (baseline)'],
      ['curious', 'curious and leaning-in interest, eyes slightly widened'],
      ['surprised', 'surprised, eyes wide open and mouth open'],
      ['worried', 'worried / troubled, eyebrows lowered'],
      ['thinking', 'thinking, gaze up/aside, mouth closed'],
      ['understood', 'a bright "I get it now" satisfied face'],
      ['happy', 'a happy cheerful smile'],
    ],
  },
  mina: {
    master: 'locked/mina_MASTER.png',
    glasses: true,
    expressions: [
      ['neutral', 'a calm gentle straight face (baseline)'],
      ['explaining', 'a gentle explaining expression with a light smile'],
      ['pointing', 'an attentive expression as if directing attention while explaining'],
      ['caution', 'a slightly serious cautioning expression, eyebrows not too furrowed'],
      ['reassuring', 'a soft reassuring smile'],
      ['thinking', 'a calm thinking expression'],
      ['positive', 'a bright positive smile'],
    ],
  },
};

async function genOnce(prompt, refB64) {
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: 'image/png', data: refB64 } }, { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const body = await res.text();
    const e = new Error(`API ${res.status}: ${body.slice(0, 200)}`);
    e.retryable = res.status === 429 || res.status >= 500;
    throw e;
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = inline?.inlineData?.data ?? inline?.inline_data?.data;
  if (!b64) throw new Error('画像データなし: ' + JSON.stringify(data).slice(0, 200));
  return Buffer.from(b64, 'base64');
}

async function gen(prompt, refB64) {
  let last;
  for (let a = 1; a <= 3; a++) {
    try { return await genOnce(prompt, refB64); }
    catch (e) { last = e; if (!e.retryable && e.name !== 'TimeoutError') break; await new Promise((r) => setTimeout(r, 2 ** a * 1000)); }
  }
  throw last;
}

const only = process.argv[2];
const ids = only ? [only] : ['haru', 'mina'];
const manifest = [];
for (const id of ids) {
  const set = SETS[id];
  if (!set) { console.error(`unknown id: ${id}`); continue; }
  if (!existsSync(set.master)) { console.error(`MASTER が無い: ${set.master}`); continue; }
  const refB64 = readFileSync(set.master).toString('base64');
  for (const [expr, desc] of set.expressions) {
    const file = `${OUT}/${id}_${expr}.png`;
    process.stdout.write(`gen ${id} ${expr} ... `);
    try {
      const raw = await gen(exprPrompt(desc, set.glasses), refB64);
      await sharp(raw).png().toFile(file);
      manifest.push({ id, expression: expr, file: `expr/${id}_${expr}.png` });
      console.log('ok');
    } catch (e) { console.error('ERR', e.message); }
  }
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} 枚生成: ${OUT}/`);
