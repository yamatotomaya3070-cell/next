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
export function renderSubtitle(speaker, textStr, o = 1) {
  if (!textStr || o <= 0) return '';
  const sp = SPEAKER[speaker] || SPEAKER.narrator;
  const size = 30, lineH = 40, padX = 24, maxTextW = W - 220;
  const lines = wrapByWidth(textStr, size, maxTextW, 2);
  const blockW = Math.max(...lines.map((l) => estWidth(l, size)), estWidth(sp.name, 15));
  const barW = Math.min(W - 60, blockW + padX * 2);
  const barH = 40 + lines.length * lineH; // 名前行(約34)+本文
  const bottom = 694, y = bottom - barH, x = (W - barW) / 2;
  const nameFrag = text(x + padX, y + 26, sp.name, { size: 15, weight: 700, fill: sp.color });
  const lineFrags = lines.map((ln, i) => text(x + padX, y + 34 + (i + 1) * lineH - 8, ln, { size, weight: 600, fill: '#ffffff' })).join('');
  return `<g opacity="${o}">
    ${roundRect(x, y, barW, barH, 12, 'rgba(12,20,22,0.88)')}
    ${roundRect(x, y, 7, barH, 12, sp.color)}
    ${nameFrag}${lineFrags}
  </g>`;
}

// 強調テロップ（画面中央やや上、アクセントのピル）
export function renderTelop(textStr, t, at = 0) {
  if (!textStr) return '';
  const a = appear(t, at, 0.35);
  if (a.o <= 0) return '';
  const pop = clamp(easePop((t - at) / 0.4));
  const size = 46;
  const tw = estWidth(textStr, size);
  const pillW = tw + 64, x = (W - pillW) / 2, y = 150;
  return `<g opacity="${a.o}" transform="translate(${W / 2} ${y + 34}) scale(${0.9 + 0.1 * pop}) translate(${-W / 2} ${-(y + 34)})">
    ${roundRect(x, y, pillW, 74, 16, T.accent)}
    ${text(W / 2, y + 52, textStr, { anchor: 'middle', size, weight: 800, fill: '#08201d' })}
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
