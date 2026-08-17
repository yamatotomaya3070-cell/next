// ハル/ミナ MASTER候補生成（STEP2-3）。05のプロンプトで各3案を text-to-image。
//   鍵は process.env.GEMINI_API_KEY か .env.local から読む（このスクリプトが読むだけ・表示しない）。
//   src/lib/image-gen/gemini.ts と同じリクエスト形（gemini-2.5-flash-image / responseModalities:["IMAGE"]）。
//   ※ 実行するとGemini画像APIに課金（6回）。生成物は poc/character/out/ に保存し、人間が1案ずつ選ぶ。
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const f of ['.env.local', '.env', '.env.development.local']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const API_KEY = loadKey();
if (!API_KEY) {
  console.error('GEMINI_API_KEY が見つかりません。環境変数に設定するか .env.local に GEMINI_API_KEY=... を置いてください。');
  process.exit(1);
}
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OUT = 'poc/character/out';
mkdirSync(OUT, { recursive: true });

const NEGATIVE = `AVOID: different person, different face/hairstyle/hair color/eye color/clothes/age/body type/glasses/proportions/art style, photorealistic, 3D render, chibi, childlike, VTuber costume, fantasy clothing, excessive accessories, logo, text, watermark, busy background, extreme perspective, dramatic lighting, overly detailed, extra fingers, malformed hands, duplicate character.`;

const HARU = `Create ONE original character reference image, upper body (waist-up), neutral expression, front view or very slight 3/4, natural standing pose, both hands visible, plain solid light background.
STYLE: modern Japanese 2D educational animation, clean line art, clean flat colors, soft cel shading, slightly warm, simple expressive face, professional but approachable, high readability, animation-friendly, consistent character design.
CHARACTER (haru): a friendly, clean-cut Japanese man, age 20-24, financial beginner / viewer stand-in. Face: rounded-but-not-too-round outline, natural 2D anime eyes (not oversized), soft eyebrows that read emotion clearly, calm approachable look. Hair: dark brown-black, short to medium, slightly natural movement (NOT flashy anime-protagonist hair). Body: average build, natural educational-anime proportions. Outfit: simple calm-blue hoodie, NO logo, NO pattern, no accessories. Character color: calm friendly blue (not vivid primary).
CONSTRAINTS: single character only, no text, no logo, no props, no other characters. Fixed reusable design (consistency id: haru). Do NOT imitate real people or existing anime characters.
${NEGATIVE}`;

const MINA = `Create ONE original character reference image, upper body (waist-up), neutral calm expression, front view or very slight 3/4, natural standing pose, both hands visible, plain solid light background.
STYLE: modern Japanese 2D educational animation, clean line art, clean flat colors, soft cel shading, slightly warm, simple expressive face, professional but approachable, high readability, animation-friendly, consistent character design.
CHARACTER (mina): an intelligent yet approachable Japanese woman, age 27-32, financial teacher / explainer. Face: soft outline, natural 2D anime eyes, gentle calm expression, trustworthy and easy to talk to (not stern, not showing off). Hair: dark brown, shoulder-length bob to medium, simple identifiable silhouette. Glasses: thin simple frame — FIXED signature element. Outfit: white/ivory inner top + calm green cardigan (softer than a suit), "friendly finance teacher", not a bank clerk. Character color: calm reassuring green (not vivid).
CONSTRAINTS: single character only, no text, no logo, no props, no other characters. Fixed reusable design (consistency id: mina). Do NOT imitate real people or existing anime characters.
${NEGATIVE}`;

const VARIANTS = [
  ' (design exploration variant 1 — keep all specified features; only tiny natural variation in head angle and hair flow.)',
  ' (design exploration variant 2 — keep all specified features; slightly different natural standing pose.)',
  ' (design exploration variant 3 — keep all specified features; very slight 3/4 angle.)',
];

async function genOnce(prompt) {
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
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

async function gen(prompt) {
  let last;
  for (let a = 1; a <= 3; a++) {
    try { return await genOnce(prompt); }
    catch (e) { last = e; if (!e.retryable && e.name !== 'TimeoutError') break; await new Promise((r) => setTimeout(r, 2 ** a * 1000)); }
  }
  throw last;
}

const manifest = [];
for (const [id, base] of [['haru', HARU], ['mina', MINA]]) {
  for (let i = 0; i < VARIANTS.length; i++) {
    const file = `${OUT}/${id}_master_${i + 1}.png`;
    process.stdout.write(`gen ${id} #${i + 1} ... `);
    try {
      const raw = await gen(base + VARIANTS[i]);
      await sharp(raw).png().toFile(file); // どのMIMEでもPNGへ正規化
      manifest.push({ id, n: i + 1, file: `${id}_master_${i + 1}.png` });
      console.log('ok');
    } catch (e) { console.error('ERR', e.message); }
  }
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} 枚生成: ${OUT}/`);
