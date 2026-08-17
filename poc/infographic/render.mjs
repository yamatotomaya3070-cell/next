// 図解PoC オーケストレータ:
//   SCENEデータ → 各フレームSVG → sharp で PNG ラスタライズ → ffmpeg で mp4 → 連結
// 本番の SVG→PNG→ffmpeg 経路（scripts/video/*）と同じ流れをPoCで再現する。
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { buildComparisonSVG } from './comparison.mjs';
import { buildNumberSVG } from './number.mjs';
import { buildChartSVG } from './chart.mjs';
import { buildTimelineSVG } from './timeline.mjs';
import { buildProcessSVG } from './process.mjs';
import { scene041, scene002, scene046, scene024, scene070 } from './scenes.mjs';

const FPS = 30, OUT = 'poc/infographic/out', FR = `${OUT}/frames`;
rmSync(FR, { recursive: true, force: true });
mkdirSync(FR, { recursive: true });

const builders = {
  comparison: buildComparisonSVG,
  number_animation: buildNumberSVG,
  chart: buildChartSVG,
  timeline: buildTimelineSVG,
  process: buildProcessSVG,
};

// 完成動画の並び順（05のセクション順に近い）
const REEL = [scene041, scene046, scene024, scene070, scene002];

async function renderScene(scene, tag) {
  const build = builders[scene.type];
  const n = Math.round(scene.durationSec * FPS);
  process.stdout.write(`\n[${scene.id}] ${scene.type} ${n}f `);
  for (let i = 0; i < n; i++) {
    const svg = build(scene, i / FPS);
    await sharp(Buffer.from(svg)).png().toFile(`${FR}/${tag}_${String(i).padStart(4, '0')}.png`);
    if (i % 30 === 0) process.stdout.write('.');
  }
  ff(['-y', '-framerate', String(FPS), '-i', `${FR}/${tag}_%04d.png`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${OUT}/${scene.id}.mp4`]);
  const still = Math.round((scene.durationSec - 0.5) * FPS);
  await sharp(Buffer.from(build(scene, still / FPS))).png().toFile(`${OUT}/${scene.id}_still.png`);
}

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr?.slice(-800)); throw new Error('ffmpeg failed'); }
}

let tag = 0;
for (const s of REEL) await renderScene(s, `s${tag++}`);

writeFileSync(`${OUT}/list.txt`, REEL.map(s => `file '${s.id}.mp4'`).join('\n') + '\n');
ff(['-y', '-f', 'concat', '-safe', '0', '-i', `${OUT}/list.txt`, '-c', 'copy', `${OUT}/reel.mp4`]);
rmSync(FR, { recursive: true, force: true });
rmSync(`${OUT}/list.txt`, { force: true });

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=width,height,avg_frame_rate',
  '-of', 'default=noprint_wrappers=1', `${OUT}/reel.mp4`], { encoding: 'utf8' });
console.log('\n\n--- reel.mp4 ---\n' + probe.stdout, 'done:', existsSync(`${OUT}/reel.mp4`));
