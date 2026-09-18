// 教科書の操作動画用ナレーションを Gemini TTS で生成する。
//   使い方: node poc/guide/tts_narration.mjs [章slug…]   （省略で全章）
//   出力: poc/guide/out/narration/<slug>/<id>.wav と durations.json（収録時に各操作を待つ秒数として使う）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SPEC = JSON.parse(readFileSync('poc/guide/narration.json', 'utf8'));
const OUT = 'poc/guide/out/narration';
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const only = process.argv.slice(2);

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
if (!KEY) { console.error('GEMINI_API_KEY が見つかりません'); process.exit(1); }

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat(r.stdout.trim()) || 0;
}

async function synth(text, file) {
  // 指示文と読み上げ文をはっきり分ける（分けないと、読み上げ文を指示と取りちがえて 400 になることがある）
  const prompt = `次の日本語の文章を、そのまま読み上げてください。話し方：${SPEC.style}\n読み上げる文章：「${text}」`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SPEC.voice } } } },
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const b64 = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new Error('音声が返りませんでした');
      writeFileSync(file, wav(Buffer.from(b64, 'base64')));
      return;
    } catch (err) {
      if (attempt === 4) throw new Error(`${file}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1500));
    }
  }
}

for (const ch of SPEC.chapters) {
  if (only.length && !only.includes(ch.slug)) continue;
  const dir = `${OUT}/${ch.slug}`;
  mkdirSync(dir, { recursive: true });
  const durations = [];
  for (const seg of ch.segments) {
    const file = `${dir}/${seg.id}.wav`;
    if (!existsSync(file)) await synth(seg.text, file);
    const d = duration(file);
    durations.push({ id: seg.id, seconds: +d.toFixed(2), action: seg.action });
    process.stdout.write(`${ch.slug}/${seg.id} ${d.toFixed(1)}s\n`);
  }
  writeFileSync(`${dir}/durations.json`, JSON.stringify(durations, null, 2));
  console.log(`== ${ch.slug}: ${durations.length}本 / 合計 ${durations.reduce((n, x) => n + x.seconds, 0).toFixed(1)}秒`);
}
