// 教科書の操作動画をつくる：画面録画（mkv）＋章ごとのナレーション（wav）→ public/guide/video/<章>.mp4
//   録画時に書き出した segments.json（各セグメントが録画の何秒目から始まったか）を使って、
//   ナレーションをその位置に置くので、声と操作がずれない。
//   使い方: node poc/guide/build_video.mjs <章スラッグ> <録画.mkv> <segments.json> [出力先]
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = `${HERE}/../..`;
const [slug, recPath, segPath, outArg] = process.argv.slice(2);
if (!slug || !recPath || !segPath) {
  console.error('使い方: node poc/guide/build_video.mjs <章スラッグ> <録画.mkv> <segments.json> [出力先]');
  process.exit(1);
}
const NARR = `${ROOT}/poc/guide/out/narration/${slug}`;
const OUT = outArg || `${ROOT}/public/guide/video/${slug}.mp4`;
const TAIL = 1.2; // 最後のナレーションが終わってから余韻を少し残す

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) { console.error(r.stderr?.slice(-2000)); throw new Error('ffmpeg failed'); }
}

// PowerShell の ConvertTo-Json は BOM 付きで書くので剥がす
const segs = JSON.parse(readFileSync(segPath, 'utf8').replace(/^﻿/, ''));
const list = Array.isArray(segs) ? segs : [segs]; // ConvertTo-Json は1件だとオブジェクトになる
const durations = JSON.parse(readFileSync(`${NARR}/durations.json`, 'utf8'));
const secOf = (id) => durations.find((d) => d.id === id)?.seconds ?? 0;

const inputs = ['-i', recPath];
const delays = [];
list.forEach((s, i) => {
  const wav = `${NARR}/${s.id}.wav`;
  if (!existsSync(wav)) throw new Error(`ナレーションがありません: ${wav}`);
  inputs.push('-i', wav);
  const ms = Math.round(s.start * 1000);
  delays.push(`[${i + 1}:a]adelay=${ms}|${ms}[n${i}]`);
});
const mix = `${delays.join(';')};${list.map((_, i) => `[n${i}]`).join('')}amix=inputs=${list.length}:normalize=0[aout]`;
const end = Math.max(...list.map((s, i) => Math.max(s.end, s.start + secOf(s.id)))) + TAIL;

mkdirSync(dirname(OUT), { recursive: true });
ff(['-y', '-v', 'error', ...inputs,
  '-filter_complex', mix,
  '-map', '0:v', '-map', '[aout]',
  '-t', end.toFixed(2),
  '-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', OUT]);

const poster = OUT.replace(/\.mp4$/, '.jpg');
const posterAt = (list[0]?.start ?? 0) + 1; // 冒頭の1秒後（真っ黒なフレームを避ける）
ff(['-y', '-v', 'error', '-ss', posterAt.toFixed(2), '-i', OUT, '-frames:v', '1', '-q:v', '4', poster]);
console.log(`=== ${slug}: ${OUT} (${end.toFixed(1)}s / ${list.length}本のナレーション) ===`);
