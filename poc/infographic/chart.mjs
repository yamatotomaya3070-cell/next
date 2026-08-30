// visual_type = chart （折れ線／エリア：資産推移など）
import { T, appear, easeOut, clamp, commas, text, roundRect, boardBG } from './shared.mjs';

const W = 1280, H = 720;
const X0 = 150, X1 = 1150, YT = 210, YB = 600;

export function buildChartSVG(scene, t) {
  const rv = scene.reveal;
  const xMax = scene.x.max, yMax = scene.yMax;
  const xToPx = (x) => X0 + (x / xMax) * (X1 - X0);
  const vToPx = (v) => YB - (v / yMax) * (YB - YT);
  const parts = [];
  parts.push(boardBG('cbg'));
  parts.push(`<defs>${scene.series.map((s, i) => `<linearGradient id="area${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity="0.35"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`).join('')}</defs>`);

  // 見出し
  const ha = appear(t, rv.headline, 0.5);
  parts.push(text(W / 2, 120 - ha.dy, scene.headline, { anchor: 'middle', size: 42, weight: 800, opacity: ha.o }));

  // グリッド＋Y軸ラベル
  const step = scene.yStep;
  for (let v = 0; v <= yMax; v += step) {
    const y = vToPx(v);
    parts.push(`<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="${T.line}" stroke-width="1" opacity="0.5"/>`);
    parts.push(text(X0 - 16, y + 8, `${v}`, { anchor: 'end', size: 22, fill: T.sub }));
  }
  parts.push(text(X0 - 16, YT - 20, scene.yUnit, { anchor: 'end', size: 22, fill: T.sub }));
  // X軸ラベル
  for (const gx of scene.x.ticks) {
    parts.push(text(xToPx(gx), YB + 40, `${gx}${scene.x.suffix || ''}`, { anchor: 'middle', size: 24, fill: T.sub }));
  }

  // 線の描画進捗（左→右）
  const p = clamp(easeOut((t - rv.draw[0]) / (rv.draw[1] - rv.draw[0])));
  const maxX = xMax * p;

  scene.series.forEach((s, i) => {
    const pts = pointsUpTo(s.points, maxX);
    if (pts.length < 2) return;
    const line = pts.map((pt, k) => `${k === 0 ? 'M' : 'L'} ${xToPx(pt.x).toFixed(1)} ${vToPx(pt.y).toFixed(1)}`).join(' ');
    if (s.area) {
      const last = pts[pts.length - 1];
      const area = `${line} L ${xToPx(last.x).toFixed(1)} ${YB} L ${xToPx(pts[0].x).toFixed(1)} ${YB} Z`;
      parts.push(`<path d="${area}" fill="url(#area${i})"/>`);
    }
    parts.push(`<path d="${line}" fill="none" stroke="${s.color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
    // 先端ドット
    const last = pts[pts.length - 1];
    parts.push(`<circle cx="${xToPx(last.x).toFixed(1)}" cy="${vToPx(last.y).toFixed(1)}" r="8" fill="${s.color}"/>`);
  });

  // 凡例＋終端コールアウト（描画完了後に出現）
  const ca = appear(t, rv.draw[1] - 0.2, 0.5);
  scene.series.forEach((s, i) => {
    const endPt = s.points[s.points.length - 1];
    const lx = X1 + 4, ly = vToPx(endPt.y);
    parts.push(`<g opacity="${ca.o}">${text(lx, ly - 22, s.name, { anchor: 'end', size: 24, weight: 600, fill: s.color })}${text(lx, ly + 14, `${s.prefix || ''}${commas(endPt.y)}${scene.yUnit}`, { anchor: 'end', size: 34, weight: 800, fill: s.color })}</g>`);
  });

  // 注記
  const na = appear(t, rv.draw[1], 0.6);
  parts.push(text(W / 2, H - 30, scene.note, { anchor: 'middle', size: 22, fill: T.sub, opacity: 0.8 * na.o }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

function pointsUpTo(points, maxX) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].x <= maxX) { out.push(points[i]); }
    else {
      // 直前点との間を補間して maxX で止める
      const a = points[i - 1], b = points[i];
      if (a) { const k = (maxX - a.x) / (b.x - a.x); out.push({ x: maxX, y: a.y + (b.y - a.y) * k }); }
      break;
    }
  }
  return out;
}
