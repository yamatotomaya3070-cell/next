// 生成した VideoProject(JSON) → 実際の音声付き動画。P0「生成→レンダ」配線の実証。
//   各 scene.visual を builders.mjs のビルダーに変換し、audio[] を Gemini TTS で合成、字幕を重ねて mux。
//   使い方: node poc/scene/render_project.mjs [project.json] [out.mp4] [SCENE_LIMIT]
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSubtitle, renderSection, inject } from '../infographic/overlay.mjs';
import { buildTitleSVG } from '../infographic/title.mjs';
import { adaptBuilder, genericCard, convFrame } from './builders.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = process.argv[2] || 'poc/scene/out/newnisa_project.json';
const OUT = process.argv[3] || 'poc/scene/out/newnisa_video.mp4';
const LIMIT = Number(process.argv[4] || process.env.SCENE_LIMIT || 0); // 0=全部
const FPS = 24, W = 1280, H = 720;
const WORK = 'poc/scene/out/work';
const VOX = 'poc/scene/out/vox';

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
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
// 生成ナレッジ（発音・表記の注意）。ワーカーが scene_generation_notes から env で渡す。
const GEN_NOTES = (process.env.GEN_NOTES || '').trim();
const SECTION_JA = { hook: 'フック', problem: '問題提起', basics: '基礎説明', example: '具体例', dialogue: '疑問と誤解', caution: '注意点', summary: 'まとめ', cta: 'はじめ方' };
const VOICE = { narrator: 'Charon', mina: 'Kore', haru: 'Puck' };

function ff(args) { const r = spawnSync('ffmpeg', args, { encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stderr?.slice(-800)); throw new Error('ffmpeg'); } }
function probe(p) { const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p], { encoding: 'utf8' }); return parseFloat(r.stdout.trim()) || 0; }
function wrapPcmToWav(pcm, rate) {
  const h = Buffer.alloc(44); const dl = pcm.length;
  h.write('RIFF', 0); h.writeUInt32LE(36 + dl, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dl, 40);
  return Buffer.concat([h, pcm]);
}

// --- Gemini TTS（1発話→wav）。emotion/deliveryをstyle promptに ---
async function synthLine(line, file) {
  if (!KEY) { // キー無し=無音1.5s
    ff(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '1.5', file]); return;
  }
  const style = `${SECTION_JA[line._section] || ''}の場面。${line.emotion}・${line.deliveryStyle}で、${line.speakingRate === 'slow' ? 'ゆっくり' : line.speakingRate === 'fast' ? 'やや速く' : '自然な速さで'}、抑揚をつけて読んで。`;
  const notes = GEN_NOTES ? `\n【表記・発音の注意（必ず守る）】\n${GEN_NOTES}` : '';
  const prompt = `${style}${notes}\n---\n${line.text}`;
  for (let a = 1; a <= 3; a++) {
    try {
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
    } catch (e) { if (a === 3) { console.error('  TTS失敗→無音', e.message); ff(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '1.5', file]); } else await new Promise((r) => setTimeout(r, 2 ** a * 1000)); }
  }
}

async function main() {
  const project = JSON.parse(readFileSync(PROJECT, 'utf8'));
  let scenes = project.scenes;
  if (LIMIT > 0) scenes = scenes.slice(0, LIMIT);
  console.log(`レンダ対象: ${scenes.length}シーン / 声=${KEY ? 'Gemini TTS' : '無音'}`);
  rmSync(WORK, { recursive: true, force: true }); mkdirSync(WORK, { recursive: true });
  mkdirSync(VOX, { recursive: true });

  // タイトル導入（3秒）
  const clips = [];
  {
    const titleScene = { title: (project.title || '').slice(0, 20), subtitle: (project.goal || '').slice(0, 24) };
    const n = Math.round(3.0 * FPS);
    for (let i = 0; i < n; i++) await sharp(Buffer.from(buildTitleSVG(titleScene, i / FPS))).png().toFile(`${WORK}/t_${String(i).padStart(4, '0')}.png`);
    ff(['-y', '-framerate', String(FPS), '-i', `${WORK}/t_%04d.png`, '-f', 'lavfi', '-t', '3.0', '-i', 'anullsrc=r=24000:cl=mono', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-shortest', `${WORK}/clip_000.mp4`]);
    clips.push('clip_000.mp4');
  }

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const tag = String(si + 1).padStart(3, '0');
    process.stdout.write(`\n[${tag}] ${scene.section}/${scene.visual.type} `);

    // 1) 各発話を合成 → 尺
    const head = 0.4, gap = 0.28, tail = 0.5;
    const parts = [];
    const sched = [];
    let cur = head;
    for (let li = 0; li < scene.audio.length; li++) {
      const line = { ...scene.audio[li], _section: scene.section };
      const wav = `${VOX}/s${tag}_l${li}.wav`;
      if (!existsSync(wav)) await synthLine(line, wav);
      const d = probe(wav);
      sched.push({ start: cur, end: cur + d, line });
      parts.push({ wav, at: cur });
      cur += d + gap;
      process.stdout.write('.');
    }
    const D = Math.max(2.5, cur - gap + tail);

    // 2) シーン音声を組み立て（head/gap無音 + 各発話）
    const sceneWav = `${WORK}/a_${tag}.wav`;
    if (parts.length) {
      const inputs = ['-y'];
      parts.forEach((p) => inputs.push('-i', p.wav));
      const fc = parts.map((p, k) => `[${k}:a]adelay=${Math.round(p.at * 1000)}:all=1[a${k}]`).join(';')
        + ';' + parts.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${D.toFixed(2)}[out]`;
      ff([...inputs, '-filter_complex', fc, '-map', '[out]', '-c:a', 'pcm_s16le', '-ar', '24000', '-ac', '1', sceneWav]);
    } else {
      ff(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', D.toFixed(2), sceneWav]);
    }

    // 3) フレーム描画
    const isConv = scene.visual.type === 'character_conversation';
    const builder = isConv ? convFrame(scene, sched) : (adaptBuilder(scene, D) || genericCard(scene));
    const secJa = SECTION_JA[scene.section] || scene.section;
    const nF = Math.round(D * FPS);
    for (let i = 0; i < nF; i++) {
      const t = i / FPS;
      let svg = builder(t);
      if (!isConv) {
        // セクション見出し＋現在の発話の字幕を重ねる
        const active = sched.find((x) => t >= x.start && t < x.end) || (t < (sched[0]?.start ?? 0) ? null : sched[sched.length - 1]);
        let frag = renderSection(secJa);
        if (active && active.line.text) frag += renderSubtitle(active.line.speaker, active.line.text, 1);
        svg = inject(svg, frag);
      }
      await sharp(Buffer.from(svg)).png().toFile(`${WORK}/f_${tag}_${String(i).padStart(4, '0')}.png`);
      if (i % 48 === 0) process.stdout.write('*');
    }
    const clip = `clip_${tag}.mp4`;
    ff(['-y', '-framerate', String(FPS), '-i', `${WORK}/f_${tag}_%04d.png`, '-i', sceneWav,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', `${WORK}/${clip}`]);
    clips.push(clip);
    // フレーム掃除（音声は残す=再開時キャッシュ）
    spawnSync('bash', ['-c', `rm -f ${WORK}/f_${tag}_*.png ${WORK}/t_*.png`]);
  }

  // 4) 連結 → BGMを声の下に敷いて最終ミックス
  writeFileSync(`${WORK}/list.txt`, clips.map((c) => `file '${c}'`).join('\n') + '\n');
  const concatMp4 = `${WORK}/_concat.mp4`;
  ff(['-y', '-f', 'concat', '-safe', '0', '-i', `${WORK}/list.txt`, '-c', 'copy', concatMp4]);
  const BGM = process.env.BGM_FILE || 'assets/video/bgm_loop.wav';
  const bgmVol = process.env.BGM_VOL || '0.10';
  if (BGM.toLowerCase() !== 'none' && existsSync(BGM)) {
    ff(['-y', '-i', concatMp4, '-stream_loop', '-1', '-i', BGM,
      '-filter_complex', `[1:a]volume=${bgmVol},aformat=sample_rates=44100:channel_layouts=stereo[bg];[0:a]aformat=sample_rates=44100:channel_layouts=stereo[vo];[vo][bg]amix=inputs=2:duration=first:normalize=0[aout]`,
      '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', OUT]);
  } else {
    ff(['-y', '-i', concatMp4, '-c', 'copy', OUT]);
  }
  const dur = probe(OUT);
  console.log(`\n\n=== 完成: ${OUT} (${dur.toFixed(1)}s / ${clips.length}クリップ / BGM=${existsSync(BGM) ? 'あり' : 'なし'}) ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
