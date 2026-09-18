// 字幕・テロップ・セクション表示のオーバーレイ部品（合成レイヤの検証用）
import { T, FONT, appear, clamp, text, roundRect, easePop } from './shared.mjs';

const W = 1280, H = 720;

// 話者色（05のsubtitleColorに準拠）: ナレ=グレー / ハル=青 / ミナ=緑
export const SPEAKER = {
  narrator: { name: 'ナレーション', color: '#C9D2D0' },
  haru: { name: 'ハル', color: '#4F8BE0' },
  mina: { name: 'ミナ先生', color: '#3EB489' },
};

export function estWidth(s, size) {
  let w = 0;
  for (const ch of s) w += (/[\x00-\x7F]/.test(ch) ? 0.56 : 1.0) * size;
  return w;
}

// 文字列を幅で折り返す（日本語=文字ごと）。最大 maxLines 行、あふれたら末尾を…に。
export function wrapByWidth(s, size, maxW, maxLines = 2) {
  const all = []; let cur = '';
  for (const ch of [...String(s)]) {
    if (ch === '\n') { all.push(cur); cur = ''; continue; }
    if (estWidth(cur + ch, size) <= maxW) cur += ch; else { all.push(cur); cur = ch; }
  }
  if (cur) all.push(cur);
  if (all.length <= maxLines) return all;
  const kept = all.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && estWidth(last + '…', size) > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = last + '…';
  return kept;
}

// 画面下の字幕バー（話者色の左帯＋名前チップ＋本文）。長文は2行に折り返す。
// 帯の大きさは DaVinci の字幕テンプレート（05_テンプレート/字幕とテロップ/絆_字幕_*.setting）と同じ固定サイズ。
// 就労者はテンプレートを置くだけなので、見本も文字数で幅を変えず、同じ見た目になるようにする。
const SUB_BAR_W = 1163;   // .setting の Width 0.9086 × 1280
const SUB_BAR_H = 123;    // .setting の Height 0.1708 × 720
const SUB_BOTTOM = 695.5; // .setting の Center Y 0.1194（下端基準）
const SUB_TEXT_W = 1112;  // .setting の LayoutWidth 0.8688 × 1280
export function renderSubtitle(speaker, textStr, o = 1) {
  if (!textStr || o <= 0) return '';
  const sp = SPEAKER[speaker] || SPEAKER.narrator;
  const size = 30, lineH = 40, padX = 24;
  const lines = wrapByWidth(textStr, size, SUB_TEXT_W, 2);
  const barW = SUB_BAR_W, barH = SUB_BAR_H;
  const y = SUB_BOTTOM - barH, x = (W - barW) / 2;
  // ノート風: クリーム帯＋薄グレー罫線＋濃色本文（話者色の左縦帯は維持）
  const nameFrag = text(x + padX, y + 26, sp.name, { size: 15, weight: 800, fill: sp.color });
  const ruleFrags = lines.map((_, i) => {
    const ry = y + 34 + (i + 1) * lineH + 4;
    return `<line x1="${x + padX}" y1="${ry}" x2="${x + barW - padX}" y2="${ry}" stroke="${T.noteRule}" stroke-width="1.5"/>`;
  }).join('');
  const lineFrags = lines.map((ln, i) => text(x + padX, y + 34 + (i + 1) * lineH - 8, ln, { size, weight: 600, fill: '#2c3a30' })).join('');
  return `<g opacity="${o}">
    ${roundRect(x, y, barW, barH, 12, T.note)}
    ${roundRect(x, y, barW, barH, 12, 'none', { stroke: T.noteRule, sw: 1.5 })}
    ${ruleFrags}
    ${roundRect(x, y, 7, barH, 12, sp.color)}
    ${nameFrag}${lineFrags}
  </g>`;
}

// 強調テロップ（画面中央やや上、アクセントのピル）
// 帯の余白・高さ・中心は DaVinci の強調テロップテンプレート（絆_強調テロップ.setting の
// Center 0.7403 / ExtendHorizontal 0.7 / ExtendVertical 0.32 / Round 0.35）に合わせてある。
const TELOP_PAD_X = 56.5; // 文字の左右に付く余白
const TELOP_H = 112;      // 帯の高さ
const TELOP_CENTER_Y = 187;
export function renderTelop(textStr, t, at = 0) {
  if (!textStr) return '';
  const a = appear(t, at, 0.35);
  if (a.o <= 0) return '';
  const pop = clamp(easePop((t - at) / 0.4));
  const size = 46;
  const tw = estWidth(textStr, size);
  const pillW = tw + TELOP_PAD_X * 2, x = (W - pillW) / 2, y = TELOP_CENTER_Y - TELOP_H / 2;
  return `<g opacity="${a.o}" transform="translate(${W / 2} ${TELOP_CENTER_Y}) scale(${0.9 + 0.1 * pop}) translate(${-W / 2} ${-TELOP_CENTER_Y})">
    ${roundRect(x, y, pillW, TELOP_H, 20, T.accent)}
    ${text(W / 2, TELOP_CENTER_Y + 16, textStr, { anchor: 'middle', size, weight: 800, fill: '#08201d' })}
  </g>`;
}

// 左上のセクション表示
export function renderSection(label, o = 1) {
  if (!label) return '';
  return `<g opacity="${0.85 * o}">${roundRect(40, 36, estWidth(label, 20) + 34, 40, 10, 'rgba(255,255,255,0.08)')}${text(57, 63, label, { size: 20, weight: 700, fill: '#cfe0dd' })}</g>`;
}

// 完成SVG文字列の </svg> 直前にフラグメントを差し込む
export function inject(svg, frag) {
  return svg.replace('</svg>', frag + '</svg>');
}
