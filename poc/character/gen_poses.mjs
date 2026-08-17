// STEP7: ポーズ差分生成（image-to-image / ロック済みMASTERを参照）。05 §9・§15 準拠。
//   §15の優先ポーズのみ（front=MASTERなので生成しない）。体の向き・腕・手だけ変える。
//   使い方: node gen_poses.mjs [haru|mina]   （引数省略で両方）
//   ※ Gemini画像APIに課金（既定：ハル4＋ミナ4）。生成物は out/pose/ に保存。
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
if (!API_KEY) { console.error('GEMINI_API_KEY が見つかりません。'); process.exit(1); }
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OUT = 'out/pose';
mkdirSync(OUT, { recursive: true });

const NEGATIVE = `AVOID: different person, different face, different hairstyle, different hair color, different eye color, different clothes, different age, different body type, different glasses, different proportions, different art style, photorealistic, 3D render, chibi, childlike, VTuber costume, fantasy clothing, excessive accessories, logo, text, watermark, busy background, extreme perspective, dramatic lighting, overly detailed, extra fingers, malformed hands, duplicate character.`;

// 05 §9 共通テンプレ
function posePrompt(desc, glasses) {
  return `Using the reference image as the EXACT same character, change ONLY the body pose / arms / hands / body orientation to: ${desc}.
Keep identical: face, expression base, outline, eyes, hairstyle, hair color, age, body type, proportions, outfit, outfit color${glasses ? ', glasses' : ''}, art style, line weight. Waist-up, plain solid light background, no text.
${NEGATIVE}`;
}

// §15 優先ポーズ（front=MASTERなので除外）
const SETS = {
  haru: {
    master: 'locked/haru_MASTER.png',
    glasses: false,
    poses: [
      ['explaining', 'palms turned slightly up, an open explaining gesture'],
      ['nodding', 'a gentle nodding listener pose, slightly leaning in'],
      ['surprised', 'leaning back a little with both hands raised slightly in surprise'],
      ['thinking', 'one hand resting on the chin, thinking'],
    ],
  },
  mina: {
    master: 'locked/mina_MASTER.png',
    glasses: true,
    poses: [
      ['pointing_left', 'pointing to the left with one hand, as if directing attention to a diagram'],
      ['pointing_right', 'pointing to the right with one hand, as if directing attention to a diagram'],
      ['explaining', 'palms turned slightly up, an open explaining gesture'],
      ['nodding', 'a gentle nodding listener pose, slightly leaning in'],
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
  if (!b64) throw new Error('画像データなし');
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
  const refB64 = readFileSync(set.master).toString('base64');
  for (const [pose, desc] of set.poses) {
    const file = `${OUT}/${id}_${pose}.png`;
    process.stdout.write(`gen ${id} ${pose} ... `);
    try {
      const raw = await gen(posePrompt(desc, set.glasses), refB64);
      await sharp(raw).png().toFile(file);
      manifest.push({ id, pose, file: `pose/${id}_${pose}.png` });
      console.log('ok');
    } catch (e) { console.error('ERR', e.message); }
  }
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} 枚生成: ${OUT}/`);
