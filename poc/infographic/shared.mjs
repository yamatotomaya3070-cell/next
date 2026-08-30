// 図解PoC 共有: デザイントークン + イージング + SVGヘルパ
// 本番ではスタイルガイド(style_guides.content)から供給する想定。

export const FONT = 'Yu Gothic UI, Meiryo, sans-serif';

// 教室×黒板テーマ（「マネーの学校」）。フレーム全体を黒板（濃緑）とし、白/チョーク色で描く。
// 旧: ネイビー(#0e1a1e/#13272b)＋teal(#22c7b4)。将来は style_guides.content から供給予定。
export const T = {
  bg0: '#345a3f',          // 黒板・上（やや明るい緑）
  bg1: '#284734',          // 黒板・下（濃い緑 ≒ #2F5233）
  ink: '#ffffff',          // チョーク白
  sub: '#dfe7d8',          // チョークグレー（緑地で可読なよう明るめ）
  panelMuted: '#2b4a37',   // 通常口座（黒板より少し明るい面）
  panelMutedHd: '#33553f',
  accentPanel: '#2f5a44',  // NISA（強調面）
  accentPanelHd: '#356450',
  accent: '#FCEEC0',       // チョーク暖色（アクセント）
  good: '#DDEBA8',         // 0円・お得（チョーク黄緑）
  warn: '#E8A07A',         // 税金マイナス（チョークオレンジ）
  line: '#6f8a76',         // 黒板の罫線（薄い白緑）
  // 木枠・チョーク・ノートの共通色
  wood: '#6B4423',
  woodDark: '#553318',
  woodLight: '#8A5A32',
  glass: '#FBEAC9',
  chalk: '#FFFFFF',
  chalkWarm: '#FCEEC0',
  note: '#FFFDF6',         // ノート帯（クリーム）
  noteRule: '#E4D9BE',     // ノート罫線（薄グレー）
};

const BOARD_W = 1280, BOARD_H = 720, FRAME = 20;

// 教室×黒板の“地”。全図解の背景をこれで共通化する。
//   木枠 → 黒板面グラデ → 下辺チョークトレイ → 右上に薄いチョーク窓ドゥードル。
// id はSVG内で一意なグラデーションID（シーンごとに別SVGなので衝突しない）。
export function boardBG(id = 'bg') {
  const bw = BOARD_W, bh = BOARD_H, f = FRAME;
  const winX = bw - 250, winY = 46, winW = 170, winH = 120; // 右上・薄いチョーク窓
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${T.bg0}"/><stop offset="1" stop-color="${T.bg1}"/></linearGradient></defs>`
    // 木枠（外周）→ 黒板面
    + `<rect width="${bw}" height="${bh}" fill="${T.woodDark}"/>`
    + `<rect x="${f}" y="${f}" width="${bw - f * 2}" height="${bh - f * 2}" fill="url(#${id})"/>`
    + `<rect x="${f}" y="${f}" width="${bw - f * 2}" height="${bh - f * 2}" fill="none" stroke="${T.wood}" stroke-width="6" opacity="0.5"/>`
    // 下辺のチョークトレイ（木のレッジ）＋チョーク片
    + `<rect x="${f}" y="${bh - f - 10}" width="${bw - f * 2}" height="10" fill="${T.woodLight}" opacity="0.9"/>`
    + `<rect x="70" y="${bh - f - 8}" width="46" height="5" rx="2.5" fill="#f7f3e8" opacity="0.85"/>`
    + `<rect x="140" y="${bh - f - 8}" width="34" height="5" rx="2.5" fill="${T.chalkWarm}" opacity="0.8"/>`
    // 右上：薄いチョーク描きの窓（教室感。低不透明で本文を邪魔しない）
    + `<g opacity="0.10" stroke="${T.chalk}" stroke-width="2.5" fill="none" stroke-linecap="round">`
    + `<rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="6"/>`
    + `<line x1="${winX + winW / 2}" y1="${winY}" x2="${winX + winW / 2}" y2="${winY + winH}"/>`
    + `<line x1="${winX}" y1="${winY + winH / 2}" x2="${winX + winW}" y2="${winY + winH / 2}"/></g>`;
}

// チョーク風の点線角丸枠（黒板上の情報ボックス）。任意でチェック丸を左に添える。
export function chalkBox(x, y, w, h, r, opts = {}) {
  const o = opts.opacity != null ? opts.opacity : 1;
  const stroke = opts.stroke || T.chalk;
  const fill = opts.fill || 'rgba(255,255,255,0.05)';
  const dash = opts.dash || '10 8';
  const check = opts.check
    ? `<circle cx="${x + 34}" cy="${y + h / 2}" r="16" fill="${T.chalkWarm}" opacity="${o}"/>`
      + `<text x="${x + 34}" y="${y + h / 2 + 7}" font-family="${FONT}" font-size="20" font-weight="800" fill="#2f5233" text-anchor="middle" opacity="${o}">✓</text>`
    : '';
  return `<g opacity="${o}">`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-dasharray="${dash}"/>`
    + `${check}</g>`;
}

// 「マネーの学校」チョークロゴ（intro/outro・タイトルで再利用）。cx中心・scale可変。
export function chalkLogo(cx, cy, scale = 1, opacity = 1) {
  const s = scale;
  return `<g transform="translate(${cx} ${cy}) scale(${s})" opacity="${opacity}" font-family="${FONT}">`
    // 学帽（モルタルボード）
    + `<g stroke="${T.chalk}" stroke-width="3" fill="none" stroke-linejoin="round">`
    + `<polygon points="-46,-118 46,-118 0,-140" fill="rgba(255,255,255,0.06)"/>`
    + `<polyline points="-30,-112 -30,-96"/><path d="M-30,-96 q30,20 60,0" />`
    + `<line x1="46" y1="-129" x2="62" y2="-108"/><circle cx="62" cy="-104" r="4" fill="${T.chalkWarm}" stroke="none"/></g>`
    // コイン（¥）※タイトル左に配置（文字と重ならないように）
    + `<g><circle cx="-268" cy="-4" r="24" fill="none" stroke="${T.chalkWarm}" stroke-width="3"/>`
    + `<text x="-268" y="6" font-size="28" font-weight="800" fill="${T.chalkWarm}" text-anchor="middle">¥</text></g>`
    // タイトル
    + `<text x="34" y="6" font-size="72" font-weight="800" fill="${T.chalk}" text-anchor="middle">マネーの学校</text>`
    // チョークの下線（少し波打たせる）
    + `<path d="M-150,44 q150,14 300,0" stroke="${T.chalkWarm}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.9"/>`
    + `</g>`;
}

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
