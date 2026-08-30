// visual_type = comparison （左右比較）
// SCENE.visual.infographic のデータ + reveal スケジュールから、時刻 t のSVGを生成。
import { T, FONT, appear, easeOut, easePop, clamp, text, roundRect, boardBG } from './shared.mjs';
import { estWidth } from './overlay.mjs';

const W = 1280, H = 720;

// テキストが maxW に収まる最大サイズ（base→min の範囲で縮小）
function fitSize(s, maxW, base, min = 20) {
  let size = base;
  while (size > min && estWidth(String(s), size) > maxW) size -= 2;
  return size;
}

export function buildComparisonSVG(scene, t) {
  const rv = scene.reveal;
  const parts = [];
  // 背景（教室×黒板）
  parts.push(boardBG('bg'));
  parts.push(`<defs>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`);

  // タイトル
  const at = appear(t, rv.title, 0.5);
  parts.push(text(W / 2, 96 - at.dy, scene.title, { anchor: 'middle', size: 46, weight: 800, opacity: at.o }));

  // パネル配置
  const panelW = 520, panelH = 452, top = 150, gap = 40;
  const leftX = W / 2 - gap / 2 - panelW;
  const rightX = W / 2 + gap / 2;
  const cols = [
    { x: leftX, appearAt: rv.colLeft, rowsAt: rv.rows.normal, data: scene.columns[0] },
    { x: rightX, appearAt: rv.colRight, rowsAt: rv.rows.nisa, data: scene.columns[1] },
  ];

  for (const col of cols) {
    const ca = appear(t, col.appearAt, 0.5, 0);
    if (!ca.shown && ca.o <= 0) continue;
    const isNisa = col.data.tone === 'accent';
    // warm: NISA列が結論後にわずかに明るくなる
    const warm = isNisa ? easeOut((t - rv.warm) / 0.8) : 0;
    const panelFill = isNisa
      ? mix(T.accentPanel, '#16564e', clamp(warm))
      : T.panelMuted;
    const headFill = isNisa ? T.accentPanelHd : T.panelMutedHd;
    const g = [];
    g.push(roundRect(col.x, top, panelW, panelH, 26, panelFill, { stroke: isNisa ? T.accent : T.line, sw: isNisa ? 2 : 1, opacity: 0.6 + 0.4 * warm }));
    // ヘッダ
    g.push(roundRect(col.x, top, panelW, 84, 26, headFill));
    g.push(roundRect(col.x, top + 42, panelW, 42, 0, headFill));
    g.push(text(col.x + panelW / 2, top + 55, col.data.label, { anchor: 'middle', size: 38, weight: 800, fill: isNisa ? T.accent : T.sub }));

    // 行
    const rowsTop = top + 84 + 26;
    const rowH = 104;
    const innerW = panelW - 80; // ラベル・値が収まる幅
    col.data.rows.forEach((row, i) => {
      const ra = appear(t, col.rowsAt[i], 0.4);
      if (ra.o <= 0) return;
      const ry = rowsTop + i * rowH + ra.dy;
      const isEmph = row.emph;
      // 強調行の背景
      if (isEmph) {
        const ep = clamp(easePop((t - rv.emph) / 0.5));
        g.push(roundRect(col.x + 18, ry - 8, panelW - 36, rowH - 20, 16, hex(T.good, 0.14 * ep)));
      }
      const cx = col.x + panelW / 2;
      // ラベル（上・小さめ・幅に収める）
      const labelSize = fitSize(row.k, innerW, 26, 18);
      g.push(text(cx, ry + 34, row.k, { anchor: 'middle', size: labelSize, weight: 600, fill: T.sub, opacity: 0.85 * ra.o }));
      // 値（下・大きめ・幅に収める・中央）
      const vColor = row.tone === 'warn' ? T.warn : row.tone === 'good' ? T.good : T.ink;
      const baseV = isEmph ? 46 : 40;
      const vSize = fitSize(row.v, innerW, baseV, 22);
      if (isEmph) {
        const pop = clamp(easePop((t - rv.emph) / 0.5));
        const scale = 1 + 0.3 * pop; // 収まる範囲で控えめに強調
        g.push(`<g transform="translate(${cx} ${ry + 78}) scale(${(0.7 + 0.3 * ra.o) * scale})" ${warm > 0.1 ? 'filter="url(#glow)"' : ''}>${text(0, 0, row.v, { anchor: 'middle', size: vSize, weight: 800, fill: vColor })}</g>`);
      } else {
        g.push(text(cx, ry + 82, row.v, { anchor: 'middle', size: vSize, weight: 800, fill: vColor, opacity: ra.o }));
      }
    });
    parts.push(`<g opacity="${ca.o}">${g.join('')}</g>`);
  }

  // VS バッジ
  const va = appear(t, Math.max(rv.colLeft, 0.6), 0.5);
  parts.push(`<g opacity="${va.o}">${roundRect(W / 2 - 34, top + panelH / 2 - 34, 68, 68, 34, T.bg0, { stroke: T.line, sw: 2 })}${text(W / 2, top + panelH / 2 + 12, 'VS', { anchor: 'middle', size: 30, weight: 800, fill: T.sub })}</g>`);

  // キャプション（出典・例）
  const cap = appear(t, rv.emph + 0.3, 0.6);
  parts.push(text(W / 2, H - 34, scene.caption, { anchor: 'middle', size: 22, weight: 400, fill: T.sub, opacity: 0.85 * cap.o }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

// --- 色ユーティリティ ---
function hex(h, a) {
  const n = h.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function mix(h1, h2, k) {
  const p = (h) => { const n = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16)); };
  const a = p(h1), b = p(h2);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
