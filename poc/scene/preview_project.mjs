// VideoProject の代表シーンを「静止フレームPNG」で即プレビュー（動画エンコード不要・軽量）。
//   使い方: node poc/scene/preview_project.mjs poc/scene/out/kabu_project.json poc/scene/out/kabu_preview
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { renderSubtitle, renderSection, inject } from '../infographic/overlay.mjs';
import { adaptBuilder, genericCard, convFrame, SECTION_JA } from './builders.mjs';

const PROJECT = process.argv[2] || 'poc/scene/out/kabu_project.json';
const OUT = process.argv[3] || 'poc/scene/out/kabu_preview';
mkdirSync(OUT, { recursive: true });
const project = JSON.parse(readFileSync(PROJECT, 'utf8'));

// 各シーンの静止フレームを1枚描く（会話は擬似タイミング、図解は出現後の時刻）。
function frameFor(scene) {
  const D = 5;
  if (scene.visual.type === 'character_conversation') {
    // audio を等間隔に並べた擬似 sched（1発話=2秒）
    let cur = 0.4; const sched = scene.audio.map((line) => { const s = { start: cur, end: cur + 1.8, line }; cur += 2.1; return s; });
    const active = sched[Math.min(1, sched.length - 1)]; // 2発話目あたりを表示
    return convFrame(scene, sched)(active.start + 0.3);
  }
  const builder = adaptBuilder(scene, D) || genericCard(scene);
  let svg = builder(D * 0.7);
  const secJa = SECTION_JA[scene.section] || scene.section;
  let frag = renderSection(secJa);
  const line = scene.audio && scene.audio[0];
  if (line && line.text) frag += renderSubtitle(line.speaker, line.text, 1);
  return inject(svg, frag);
}

let i = 0;
for (const scene of project.scenes) {
  i += 1;
  const name = `${OUT}/s${String(i).padStart(2, '0')}_${scene.section}_${scene.visual.type}.png`;
  await sharp(Buffer.from(frameFor(scene))).png().toFile(name);
  console.log(name.split('/').pop());
}
console.log(`done: ${project.title}`);
