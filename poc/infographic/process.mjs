// visual_type = process （手順・ステップ）
import { T, appear, easeOut, easePop, clamp, text, roundRect, boardBG } from './shared.mjs';

const W = 1280, H = 720;

export function buildProcessSVG(scene, t) {
  const rv = scene.reveal;
  const parts = [];
  parts.push(boardBG('pbg'));

  const ha = appear(t, rv.headline, 0.5);
  parts.push(text(W / 2, 120 - ha.dy, scene.headline, { anchor: 'middle', size: 42, weight: 800, opacity: ha.o }));

  const n = scene.steps.length;
  const cardW = 300, gap = 60, cardH = 320, top = 220;
  const totalW = n * cardW + (n - 1) * gap;
  let x = (W - totalW) / 2;

  scene.steps.forEach((st, i) => {
    const a = appear(t, rv.steps[i], 0.45);
    const active = a.o;
    const cx = x + cardW / 2;
    // 矢印（前カードとの間）
    if (i > 0) {
      const ax = x - gap / 2, ay = top + cardH / 2;
      const arA = appear(t, rv.steps[i] - 0.1, 0.3);
      parts.push(`<g opacity="${arA.o}"><path d="M ${ax - 16} ${ay} L ${ax + 16} ${ay} M ${ax + 4} ${ay - 12} L ${ax + 16} ${ay} L ${ax + 4} ${ay + 12}" stroke="${T.accent}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`);
    }
    if (a.o > 0) {
      const pop = clamp(easePop((t - rv.steps[i]) / 0.5));
      const g = [];
      g.push(roundRect(x, top + a.dy, cardW, cardH, 22, T.accentPanel, { stroke: T.accent, sw: 2, opacity: 0.55 + 0.45 * pop }));
      // STEP バッジ（丸番号）
      g.push(`<circle cx="${cx}" cy="${top + 72 + a.dy}" r="42" fill="${T.accent}"/>`);
      g.push(text(cx, top + 86 + a.dy, `${st.n}`, { anchor: 'middle', size: 46, weight: 800, fill: T.bg0 }));
      // タイトル・説明
      g.push(text(cx, top + 160 + a.dy, st.title, { anchor: 'middle', size: 32, weight: 800, fill: T.ink }));
      wrap(st.desc, 11).forEach((ln, k) =>
        g.push(text(cx, top + 210 + k * 34 + a.dy, ln, { anchor: 'middle', size: 25, fill: T.sub })));
      // チェック（少し遅れて）
      const ck = appear(t, rv.steps[i] + 0.4, 0.35);
      if (ck.o > 0) g.push(`<g opacity="${ck.o}"><circle cx="${x + cardW - 34}" cy="${top + 34 + a.dy}" r="18" fill="${T.good}"/><path d="M ${x + cardW - 42} ${top + 34 + a.dy} l 6 6 l 10 -12" stroke="${T.bg0}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`);
      parts.push(`<g opacity="${a.o}">${g.join('')}</g>`);
    }
    x += cardW + gap;
  });

  const na = appear(t, rv.steps[n - 1] + 0.3, 0.6);
  parts.push(text(W / 2, H - 44, scene.note, { anchor: 'middle', size: 24, weight: 600, fill: T.good, opacity: na.o }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

function wrap(s, per) {
  const out = []; for (let i = 0; i < s.length; i += per) out.push(s.slice(i, i + per));
  return out.slice(0, 3);
}
