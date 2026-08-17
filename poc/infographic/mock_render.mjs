// 「どんな動画になるか」の見本リール:
//   タイトル → 図解(字幕付) → キャラ会話(仮シルエット) → 図解 → まとめCTA を1本に。
//   無音・立ち絵は仮。図解/字幕/テロップ/話者色分け/会話の合成レイヤを実映像で見せる。
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { buildNumberSVG } from './number.mjs';
import { buildComparisonSVG } from './comparison.mjs';
import { buildChartSVG } from './chart.mjs';
import { buildProcessSVG } from './process.mjs';
import { buildConversationSVG } from './conversation.mjs';
import { buildTitleSVG, buildKeywordsSVG } from './title.mjs';
import { scene002, scene041, scene046, scene070 } from './scenes.mjs';
import { renderSubtitle, renderSection, inject } from './overlay.mjs';

const FPS = 30, OUT = 'poc/infographic/out', FR = `${OUT}/frames`;
rmSync(FR, { recursive: true, force: true });
mkdirSync(FR, { recursive: true });

// 図解シーンに字幕＋セクションを重ねるラッパ
const withSub = (build, scene, sub, section) => (t) =>
  inject(build(scene, t), renderSection(section) + renderSubtitle(sub.speaker, sub.text, 1));

// 会話シーン定義（仮シルエット）
const convScene = {
  section: '疑問と誤解',
  telop: { text: 'NISA ＝ 元本保証ではない', at: 3.2 },
  turns: [
    { speaker: 'haru', start: 0, dur: 3.0, text: 'ミナ先生、NISAなら絶対に儲かるんですか！？' },
    { speaker: 'mina', start: 3.0, dur: 3.2, text: 'そこは、かなり勘違いしやすいポイントだよ。' },
  ],
};
const titleScene = { title: '新NISAって結局何？', subtitle: '10分でわかる・お金の基本' };
const ctaScene = { headline: '覚えるのは、この3つ', words: ['長期', '積立', '分散'], note: '最初の一歩は「口座を開く」だけ' };

// リール構成: [builder(t), durationSec, tag]
const REEL = [
  [ (t) => buildTitleSVG(titleScene, t), 3.0, 'a' ],
  [ withSub(buildNumberSVG, scene002, { speaker: 'narrator', text: '毎月1万円。20年後、その差は約171万円。' }, 'フック'), 5.0, 'b' ],
  [ withSub(buildComparisonSVG, scene041, { speaker: 'mina', text: 'NISAなら、利益にかかる税金がゼロ円になるの。' }, '数字で見る'), 7.5, 'c' ],
  [ (t) => buildConversationSVG(convScene, t), 6.2, 'd' ],
  [ withSub(buildChartSVG, scene046, { speaker: 'narrator', text: '長い目で見ると、この差が効いてきます。' }, '資産推移'), 6.0, 'e' ],
  [ withSub(buildProcessSVG, scene070, { speaker: 'mina', text: 'はじめ方は、たったの3ステップだよ。' }, 'はじめ方'), 5.5, 'f' ],
  [ (t) => buildKeywordsSVG(ctaScene, t), 4.0, 'g' ],
];

function ff(args) { const r = spawnSync('ffmpeg', args, { encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stderr?.slice(-800)); throw new Error('ffmpeg'); } }

const clips = [];
for (const [build, dur, tag] of REEL) {
  const n = Math.round(dur * FPS);
  process.stdout.write(`\n[${tag}] ${n}f `);
  for (let i = 0; i < n; i++) {
    await sharp(Buffer.from(build(i / FPS))).png().toFile(`${FR}/${tag}_${String(i).padStart(4, '0')}.png`);
    if (i % 30 === 0) process.stdout.write('.');
  }
  const mp4 = `${OUT}/mock_${tag}.mp4`;
  ff(['-y', '-framerate', String(FPS), '-i', `${FR}/${tag}_%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
  clips.push(`mock_${tag}.mp4`);
}
writeFileSync(`${OUT}/mock_list.txt`, clips.map((c) => `file '${c}'`).join('\n') + '\n');
ff(['-y', '-f', 'concat', '-safe', '0', '-i', `${OUT}/mock_list.txt`, '-c', 'copy', `${OUT}/mock_reel.mp4`]);
// 代表スチル
await sharp(Buffer.from(buildConversationSVG(convScene, 4.0))).png().toFile(`${OUT}/mock_conv_still.png`);
await sharp(Buffer.from(withSub(buildComparisonSVG, scene041, { speaker: 'mina', text: 'NISAなら、利益にかかる税金がゼロ円になるの。' }, '数字で見る')(6.5))).png().toFile(`${OUT}/mock_cmp_still.png`);
rmSync(FR, { recursive: true, force: true });
clips.forEach((c) => rmSync(`${OUT}/${c}`, { force: true }));
rmSync(`${OUT}/mock_list.txt`, { force: true });

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=width,height', '-of', 'default=noprint_wrappers=1', `${OUT}/mock_reel.mp4`], { encoding: 'utf8' });
console.log('\n\n--- mock_reel.mp4 ---\n' + probe.stdout, 'done:', existsSync(`${OUT}/mock_reel.mp4`));
