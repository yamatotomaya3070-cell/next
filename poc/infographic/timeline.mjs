// visual_type = timeline （制度の変遷などの時系列）
import { T, appear, easeOut, easePop, clamp, text, roundRect, boardBG } from './shared.mjs';

const W = 1280, H = 720;

export function buildTimelineSVG(scene, t) {
  const rv = scene.reveal;
  const parts = [];
  parts.push(boardBG('tbg'));
  parts.push(`<defs><filter id="tglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`);

  const ha = appear(t, rv.headline, 0.5);
  parts.push(text(W / 2, 120 - ha.dy, scene.headline, { anchor: 'middle', size: 42, weight: 800, opacity: ha.o }));

  const n = scene.points.length;
  const axisY = 380;
  const padX = 200;
  const xAt = (i) => padX + (i / (n - 1)) * (W - padX * 2);

  // 軸線（左→右に伸びる）
  const lineP = clamp(easeOut((t - rv.nodes[0]) / (rv.nodes[n - 1] - rv.nodes[0] + 0.5)));
  const x0 = xAt(0), x1 = xAt(n - 1);
  parts.push(`<line x1="${x0}" y1="${axisY}" x2="${x0 + (x1 - x0) * lineP}" y2="${axisY}" stroke="${T.line}" stroke-width="4"/>`);

  scene.points.forEach((pt, i) => {
    const a = appear(t, rv.nodes[i], 0.45);
    if (a.o <= 0) return;
    const x = xAt(i);
    const emph = pt.emph;
    const pop = clamp(easePop((t - rv.nodes[i]) / 0.5));
    const r = (emph ? 22 : 14) * (0.5 + 0.5 * pop);
    const color = emph ? T.good : T.accent;
    const glow = emph ? ' filter="url(#tglow)"' : '';
    parts.push(`<g opacity="${a.o}"${glow}><circle cx="${x}" cy="${axisY}" r="${r}" fill="${color}"/>${emph ? `<circle cx="${x}" cy="${axisY}" r="${r + 10}" fill="none" stroke="${color}" stroke-width="2" opacity="0.5"/>` : ''}</g>`);
    // 年（上）
    parts.push(text(x, axisY - 60 - a.dy, pt.year, { anchor: 'middle', size: emph ? 44 : 34, weight: 800, fill: emph ? T.good : T.ink, opacity: a.o }));
    // ラベル（下・カード）
    const lw = 250, lh = 92, lx = x - lw / 2, ly = axisY + 46 + a.dy;
    parts.push(roundRect(lx, ly, lw, lh, 14, emph ? T.accentPanel : T.panelMuted, { stroke: emph ? T.good : T.line, sw: emph ? 2 : 1, opacity: a.o }));
    wrap(pt.label, 12).forEach((ln, k) =>
      parts.push(text(x, ly + 38 + k * 32, ln, { anchor: 'middle', size: 26, weight: emph ? 700 : 500, fill: emph ? T.ink : T.sub, opacity: a.o })));
  });

  const na = appear(t, rv.emphAt + 0.3, 0.6);
  parts.push(text(W / 2, H - 34, scene.note, { anchor: 'middle', size: 22, fill: T.sub, opacity: 0.8 * na.o }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

function wrap(s, per) {
  const out = []; for (let i = 0; i < s.length; i += per) out.push(s.slice(i, i + per));
  return out.slice(0, 2);
}
