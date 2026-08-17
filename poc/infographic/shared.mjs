// 図解PoC 共有: デザイントークン + イージング + SVGヘルパ
// 本番ではスタイルガイド(style_guides.content)から供給する想定。

export const FONT = 'Yu Gothic UI, Meiryo, sans-serif';

export const T = {
  bg0: '#0e1a1e',
  bg1: '#13272b',
  ink: '#ffffff',
  sub: '#aebcbb',
  panelMuted: '#22323a',   // 通常口座
  panelMutedHd: '#2c3f47',
  accentPanel: '#0f3f3a',  // NISA
  accentPanelHd: '#12514a',
  accent: '#22c7b4',
  good: '#37d39a',         // 0円・お得
  warn: '#e0705f',         // 税金マイナス
  line: '#33474e',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// ease-out cubic
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
// pop: 0→1で少しオーバーシュート
export const easePop = (x) => {
  const c1 = 1.70158, c3 = c1 + 1;
  const t = clamp(x);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// 出現アニメ: 指定秒 at から dur かけて opacity+上方向スライド
export function appear(t, at, dur = 0.45, rise = 26) {
  const p = easeOut((t - at) / dur);
  return { o: clamp(p), dy: (1 - p) * rise, shown: t >= at };
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const commas = (n) => Math.round(n).toLocaleString('en-US');

export function roundRect(x, y, w, h, r, fill, opts = {}) {
  const stroke = opts.stroke ? ` stroke="${opts.stroke}" stroke-width="${opts.sw || 1}"` : '';
  const op = opts.opacity != null ? ` opacity="${opts.opacity}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"${stroke}${op}/>`;
}

export function text(x, y, s, opts = {}) {
  const anchor = opts.anchor || 'start';
  const size = opts.size || 34;
  const weight = opts.weight || 400;
  const fill = opts.fill || T.ink;
  const op = opts.opacity != null ? ` opacity="${opts.opacity}"` : '';
  const ls = opts.spacing ? ` letter-spacing="${opts.spacing}"` : '';
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}${op}>${esc(s)}</text>`;
}
