// 「マネーの学校」固定オープニング/エンディングを事前レンダしてコミットする専用スクリプト。
//   毎回同一の導入/締めを opening.mp4 / ending.mp4 として作り、render_project.mjs が前後に concat する。
//   ・映像は SVG→sharp→ffmpeg の機械合成（AI画像生成は追加しない。ハル/ミナは既存の切り抜きPNGを流用）。
//   ・固定セリフ音声は TTS で「1回だけ」合成し assets/video/ にキャッシュ（存在すれば再生成しない）。
//   ・BGMは opening/ending 用バリエーションを内包する（本編BGMとの二重掛けを避けるため、
//     render_project 側は本編のみに body BGM を敷く）。
//   出力コーデックは本編クリップと厳密一致：1280x720 / 24fps / libx264 yuv420p / aac 44100 stereo。
//   使い方: node poc/scene/gen_intro_outro.mjs
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { boardBG, chalkLogo, text, T } from '../infographic/shared.mjs';
import { buildConversationSVG } from '../infographic/conversation.mjs';

const W = 1280, H = 720, FPS = 24;
const OUT_DIR = 'assets/video';
const WORK = 'poc/scene/out/introoutro_work';
const VOICE = { narrator: 'Charon', mina: 'Kore', haru: 'Puck' };
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';

// ============ 編集可能な固定コンテンツ（ここだけ変えれば全動画に反映） ============
// オープニングはロゴカードのみ（キャラの挨拶・自己紹介を入れない）。
//   理由: 各動画の台本1シーン目(hook)で、ハル/ミナが毎回「こんにちは、ミナ先生です」
//   「ハルです！」と挨拶・自己紹介する構成になっている（src/lib/scene/generate.ts のプロンプト）。
//   固定オープニングでも同じ挨拶をすると自己紹介が2回連続してしまい不自然なため、
//   固定オープニングは「マネーの学校」のロゴ表示に徹し、挨拶は本編1シーン目に一本化する。
const SERIES = 'マネーの学校';
const OPENING = {
  logoSec: 3.2,                // 黒板ロゴ静止カット（キャラなし）
  logoSubtitle: '初心者向け・お金の教室',
  lines: [],
};
const ENDING = {
  logoSec: 2.2,
  logoSubtitle: 'また会いましょう',
  lines: [
    { speaker: 'mina', emotion: 'warm', text: '今日もおつかれさまでした。' },
    { speaker: 'haru', emotion: 'bright_confident', text: 'また次回のマネーの学校で会いましょう。' },
  ],
};
// =================================================================================

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr?.slice(-1200)); throw new Error('ffmpeg failed'); }
}
function probe(p) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p], { encoding: 'utf8' });
  return parseFloat(r.stdout.trim()) || 0;
}
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

function wrapPcmToWav(pcm, rate) {
  const h = Buffer.alloc(44); const dl = pcm.length;
  h.write('RIFF', 0); h.writeUInt32LE(36 + dl, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dl, 40);
  return Buffer.concat([h, pcm]);
}

// 固定セリフ音声を1回だけ合成しキャッシュ。Gemini→(Windows)SAPI→無音 の順でフォールバック。
async function synthCached(line, file) {
  if (existsSync(file)) return;
  if (KEY) {
    try {
      const prompt = `${line.emotion}で、やさしく、抑揚をつけて読んで。\n---\n${line.text}`;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE[line.speaker] || 'Charon' } } } } }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error('tts ' + r.status);
      const j = await r.json();
      const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new Error('no audio');
      writeFileSync(file, wrapPcmToWav(Buffer.from(b64, 'base64'), 24000));
      return;
    } catch (e) { console.error(`  Gemini TTS失敗(${line.speaker})→フォールバック: ${e.message}`); }
  }
  if (process.platform === 'win32') {
    try {
      const ps = `$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Speech;`
        + `$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;try{$s.SelectVoice('Microsoft Haruka Desktop')}catch{};`
        + `$s.Rate=0;$s.SetOutputToWaveFile('${file.replace(/'/g, "''")}');$s.Speak([Console]::In.ReadToEnd());$s.SetOutputToNull();$s.Dispose();`;
      const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { input: line.text, encoding: 'utf8' });
      if (r.status === 0 && existsSync(file)) return;
      console.error(`  SAPI失敗(${line.speaker})→無音: ${r.stderr?.slice(-200) || ''}`);
    } catch (e) { console.error(`  SAPI例外→無音: ${e.message}`); }
  }
  ff(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '1.6', file]); // 無音フォールバック
}

// ロゴ静止カット（黒板にチョークでロゴ）。t: カット内時刻。
function logoFrame(t, subtitle) {
  const fadeIn = Math.min(1, t / 0.6);
  let s = boardBG('lg');
  s += chalkLogo(W / 2, H / 2 - 20, 1.0, fadeIn);
  if (subtitle) s += text(W / 2, H - 120, subtitle, { anchor: 'middle', size: 30, weight: 600, fill: T.sub, opacity: Math.min(1, Math.max(0, (t - 0.8) / 0.6)) });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

// 会話カット（既存 buildConversationSVG を流用。turns は 0 起点、localT を渡す）。
function convScene(lines, sched) {
  return {
    section: '',
    telop: { text: SERIES, at: 0.3 },
    turns: sched.map((x) => ({ speaker: x.line.speaker, start: x.start, dur: x.end - x.start + 0.05, text: x.line.text, emotion: x.line.emotion })),
  };
}

async function buildClip({ tag, spec, bgmFile, fadeOut }) {
  const outMp4 = `${OUT_DIR}/${tag}.mp4`;
  rmSync(WORK, { recursive: true, force: true }); mkdirSync(WORK, { recursive: true });
  const hasLines = spec.lines.length > 0;

  // 1) 固定セリフを合成（キャッシュ）＋尺取得（lines が空＝ロゴのみのクリップならスキップ）
  const head = 0.35, gap = 0.28, tail = 0.6;
  const sched = []; let cur = head;
  for (let i = 0; i < spec.lines.length; i++) {
    const line = spec.lines[i];
    const wav = `${OUT_DIR}/${tag}_${line.speaker}_${i}.wav`;
    await synthCached(line, wav);
    const d = probe(wav);
    sched.push({ line, wav, start: cur, end: cur + d });
    cur += d + gap;
  }
  const convD = hasLines ? Math.max(2.2, cur - gap + tail) : 0;
  const total = spec.logoSec + convD;

  // 2) フレーム描画（logoSec まではロゴ、以降は会話。lines が空ならロゴのみで尺いっぱい）
  const scene = hasLines ? convScene(spec.lines, sched) : null;
  const nF = Math.round(total * FPS);
  for (let i = 0; i < nF; i++) {
    const t = i / FPS;
    const svg = t < spec.logoSec ? logoFrame(t, spec.logoSubtitle) : buildConversationSVG(scene, t - spec.logoSec);
    await sharp(Buffer.from(svg)).png().toFile(`${WORK}/f_${String(i).padStart(4, '0')}.png`);
  }

  // 3) 音声（無音ベース＋セリフ＋BGMバリエーション）を 44100 stereo で組む
  const aWav = `${WORK}/audio.wav`;
  const inputs = [];
  const fl = [];
  sched.forEach((x, k) => {
    inputs.push('-i', x.wav);
    const at = Math.round((spec.logoSec + x.start) * 1000);
    fl.push(`[${k}:a]adelay=${at}:all=1,aresample=44100,aformat=channel_layouts=stereo[v${k}]`);
  });
  const bi = sched.length; // BGM入力インデックス
  inputs.push('-stream_loop', '-1', '-i', bgmFile);
  const bgFade = fadeOut ? `,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2` : '';
  fl.push(`[${bi}:a]volume=0.18,aresample=44100,aformat=channel_layouts=stereo,atrim=0:${total.toFixed(2)}${bgFade}[bg]`);
  const mixIn = sched.map((_, k) => `[v${k}]`).join('') + '[bg]';
  fl.push(`${mixIn}amix=inputs=${sched.length + 1}:normalize=0,apad,atrim=0:${total.toFixed(2)}[out]`);
  ff(['-y', ...inputs, '-filter_complex', fl.join(';'), '-map', '[out]', '-ac', '2', '-ar', '44100', aWav]);

  // 4) クリップ化（本編クリップと厳密同一コーデック → concat -c copy 可能）
  ff(['-y', '-framerate', String(FPS), '-i', `${WORK}/f_%04d.png`, '-i', aWav,
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart', outMp4]);
  console.log(`生成: ${outMp4} (${probe(outMp4).toFixed(1)}s)`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  // 引数で対象を絞れる: node gen_intro_outro.mjs [opening|ending]（省略時は両方）
  const only = process.argv[2]; // 'opening' | 'ending' | undefined
  console.log(`固定クリップ生成(${only ?? '両方'}) / 声=${KEY ? 'Gemini TTS' : (process.platform === 'win32' ? 'SAPI' : '無音')}`);
  if (!only || only === 'opening') {
    await buildClip({ tag: 'opening', spec: OPENING, bgmFile: `${OUT_DIR}/bgm_opening.wav`, fadeOut: false });
  }
  if (!only || only === 'ending') {
    await buildClip({ tag: 'ending', spec: ENDING, bgmFile: `${OUT_DIR}/bgm_ending.wav`, fadeOut: true });
  }
  rmSync(WORK, { recursive: true, force: true });
  console.log('生成完了');
}

main().catch((e) => { console.error(e); process.exit(1); });
