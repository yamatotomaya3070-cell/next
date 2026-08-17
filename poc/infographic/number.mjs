// visual_type = number_animation （カウントアップ）
import { T, FONT, appear, easeOut, easePop, clamp, commas, text, roundRect } from './shared.mjs';

const W = 1280, H = 720;

// テキスト幅の概算（全角≒1.0em / 半角≒0.56em）。フォント計測なしでフィット判定に使う。
function estWidth(s, size) {
  let w = 0;
  for (const ch of s) w += (/[\x00-\x7F]/.test(ch) ? 0.56 : 1.0) * size;
  return w;
}

export function buildNumberSVG(scene, t) {
  const rv = scene.reveal;
  const parts = [];
  parts.push(`<defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.bg0}"/><stop offset="1" stop-color="${T.bg1}"/></linearGradient>
    <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#bg2)"/>`);

  // 見出し
  const ha = appear(t, rv.headline, 0.5);
  parts.push(text(W / 2, 170 - ha.dy, scene.headline, { anchor: 'middle', size: 44, weight: 700, fill: T.ink, opacity: ha.o }));

  // カウント値
  const p = clamp((t - rv.countStart) / (rv.countEnd - rv.countStart));
  const eased = easeOut(p);
  const val = scene.count.from + (scene.count.to - scene.count.from) * eased;
  const popScale = 1 + 0.12 * clamp(easePop((t - rv.pop) / 0.4)) * (t >= rv.pop ? 1 : 0);
  const started = t >= rv.countStart;
  if (started) {
    const glow = t >= rv.pop ? ' filter="url(#glow2)"' : '';
    const SIZE = 150, MAXW = 1180;
    // 最終文字列（最も幅広）を基準に固定スケールを算出しフレーム内に収める
    const refStr = `${scene.count.prefix}${commas(scene.count.to)}${scene.count.suffix}`;
    const fit = Math.min(1, MAXW / (estWidth(refStr, SIZE)));
    const numStr = `${scene.count.prefix}${commas(val)}${scene.count.suffix}`;
    parts.push(`<g transform="translate(${W / 2} 400) scale(${popScale * fit})"${glow}>${text(0, 0, numStr, { anchor: 'middle', size: SIZE, weight: 800, fill: T.good })}</g>`);
  }

  // サブ
  const sa = appear(t, rv.sub, 0.5);
  parts.push(text(W / 2, 500, scene.sub, { anchor: 'middle', size: 34, weight: 600, fill: T.sub, opacity: sa.o }));

  // 進捗バー
  parts.push(roundRect(W / 2 - 320, 548, 640, 14, 7, T.panelMuted));
  parts.push(roundRect(W / 2 - 320, 548, 640 * eased * (started ? 1 : 0), 14, 7, T.accent));

  // 注記（リスク・例）
  const na = appear(t, rv.sub + 0.2, 0.6);
  parts.push(text(W / 2, H - 40, scene.note, { anchor: 'middle', size: 22, weight: 400, fill: T.sub, opacity: 0.8 * na.o }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}
