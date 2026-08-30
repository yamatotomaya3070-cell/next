// タイトルカード（動画冒頭）
import { T, appear, easeOut, clamp, easePop, text, roundRect, boardBG, chalkBox } from './shared.mjs';
const W = 1280, H = 720;

export function buildTitleSVG(scene, t) {
  const parts = [];
  parts.push(boardBG('ttbg'));
  // アイキャッチの帯
  const b = appear(t, 0.1, 0.5);
  parts.push(roundRect(W / 2 - 120, 210 - b.dy, 240, 44, 22, T.accent, { opacity: b.o }));
  parts.push(text(W / 2, 240 - b.dy, '初心者向け・図解でやさしく', { anchor: 'middle', size: 22, weight: 700, fill: '#08201d', opacity: b.o }));
  // タイトル
  const a = appear(t, 0.35, 0.6);
  const pop = clamp(easePop((t - 0.35) / 0.6));
  parts.push(`<g transform="translate(${W / 2} 360) scale(${0.92 + 0.08 * pop})">${text(0, 0, scene.title, { anchor: 'middle', size: 84, weight: 800, fill: '#ffffff' })}</g>`);
  parts.push(`<g opacity="${a.o}"></g>`);
  // サブ
  const s = appear(t, 0.7, 0.5);
  parts.push(text(W / 2, 450, scene.subtitle, { anchor: 'middle', size: 32, weight: 600, fill: '#a9c2be', opacity: s.o }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

// まとめ/CTAの合言葉カード（語を1つずつ）
export function buildKeywordsSVG(scene, t) {
  const parts = [];
  parts.push(boardBG('kwbg'));
  parts.push(text(W / 2, 150, scene.headline, { anchor: 'middle', size: 40, weight: 800, fill: '#ffffff', opacity: appear(t, 0.1, 0.4).o }));
  const n = scene.words.length;
  const gap = 40, cardW = 300, totalW = n * cardW + (n - 1) * gap;
  let x = (W - totalW) / 2;
  scene.words.forEach((w, i) => {
    const a = appear(t, 0.5 + i * 0.5, 0.4);
    if (a.o > 0) {
      parts.push(`<g opacity="${a.o}" transform="translate(0 ${a.dy})">
        ${chalkBox(x, 300, cardW, 160, 20, {})}
        ${text(x + cardW / 2, 402, w, { anchor: 'middle', size: 56, weight: 800, fill: T.chalkWarm })}
      </g>`);
    }
    x += cardW + gap;
  });
  parts.push(text(W / 2, 560, scene.note, { anchor: 'middle', size: 28, weight: 600, fill: '#a9c2be', opacity: appear(t, 0.5 + n * 0.5, 0.5).o }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}
