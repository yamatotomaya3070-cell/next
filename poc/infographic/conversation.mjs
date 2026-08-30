// visual_type = character_conversation
// 立ち絵は 承認済みMASTER由来の本アセット（背景透過済み・表情7種）。
// ・話す発話の emotion に応じて表情を差し替える（ただの1枚ではない）
// ・話者は軽く縦に揺れて「しゃべっている」感を出す（口パク素材が無い分の代替）
// ・非話者は暗く落とさず、少し後ろに引くだけ（減光の不自然さを解消）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { T, FONT, appear, text, boardBG } from './shared.mjs';
import { renderSubtitle, renderTelop, renderSection } from './overlay.mjs';

const W = 1280, H = 720;
const HERE = dirname(fileURLToPath(import.meta.url));
const CUT = resolve(HERE, '../character/out/cutout/reel');

function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
function load(name) {
  const buf = readFileSync(resolve(CUT, `${name}.png`));
  const { w, h } = pngSize(buf);
  return { uri: `data:image/png;base64,${buf.toString('base64')}`, w, h };
}

// キャラ×表情を一度だけ読み込む
const HARU_EXPR = ['neutral', 'curious', 'surprised', 'worried', 'thinking', 'understood', 'happy'];
const MINA_EXPR = ['neutral', 'explaining', 'pointing', 'caution', 'reassuring', 'thinking', 'positive'];
function loadSet(id, list) { const m = {}; for (const e of list) m[e] = load(`${id}_${e}`); return m; }
const ART = { haru: loadSet('haru', HARU_EXPR), mina: loadSet('mina', MINA_EXPR) };

// emotion → 各キャラの表情
const HARU_MAP = { neutral: 'neutral', curious: 'curious', tension: 'thinking', positive_surprise: 'surprised', surprise: 'surprised', realization: 'understood', puzzled: 'worried', calm_warm: 'neutral', serious: 'worried', gentle_warning: 'worried', warm: 'happy', bright_confident: 'happy', encouraging: 'happy' };
const MINA_MAP = { neutral: 'neutral', curious: 'explaining', tension: 'explaining', positive_surprise: 'positive', surprise: 'positive', realization: 'positive', puzzled: 'thinking', calm_warm: 'explaining', serious: 'caution', gentle_warning: 'caution', warm: 'reassuring', bright_confident: 'positive', encouraging: 'positive' };
const exprFor = (id, emotion) => (id === 'haru' ? HARU_MAP : MINA_MAP)[emotion] || 'neutral';

// 立ち絵1体を配置。activeなら表情=emotion＋しゃべり揺れ＋前に、非activeはneutral＋少し引く。
function figure(id, cx, active, expr, localT) {
  const set = ART[id];
  const art = set[expr] || set.neutral;
  const bottom = 735;
  const bob = active ? Math.sin(localT * Math.PI * 2 * 2.2) * 3 : 0; // しゃべり揺れ(±3px)
  const scale = active ? 1.0 : 0.965;
  const w = art.w * scale, h = art.h * scale;
  const x = cx - w / 2, y = bottom - h - bob;
  const op = active ? 1 : 0.9;
  // active の足元に淡いグラウンドグロー（暗くする代わりに主役を持ち上げる）
  const glow = active ? `<ellipse cx="${cx}" cy="${bottom - 6}" rx="${w * 0.42}" ry="26" fill="${T.accent}" opacity="0.14"/>` : '';
  return `${glow}<image href="${art.uri}" xlink:href="${art.uri}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" opacity="${op}" preserveAspectRatio="xMidYMax meet"/>`;
}

export function buildConversationSVG(scene, t) {
  const parts = [];
  parts.push(boardBG('cvbg'));

  const turn = scene.turns.find((x) => t >= x.start && t < x.start + x.dur) || scene.turns[scene.turns.length - 1];
  const haruActive = turn.speaker === 'haru';
  const localT = t - turn.start;
  const emo = turn.emotion || 'neutral';

  const haruCx = 210, minaCx = 1070;
  const haruExpr = haruActive ? exprFor('haru', emo) : 'neutral';
  const minaExpr = !haruActive ? exprFor('mina', emo) : 'neutral';
  parts.push(figure('haru', haruCx, haruActive, haruExpr, localT));
  parts.push(figure('mina', minaCx, !haruActive, minaExpr, localT));
  // 名前ラベル（頭上）
  parts.push(text(haruCx, 182, 'ハル', { anchor: 'middle', size: 22, weight: 700, fill: haruActive ? '#7FA8E8' : '#8792a0' }));
  parts.push(text(minaCx, 182, 'ミナ先生', { anchor: 'middle', size: 22, weight: 700, fill: !haruActive ? '#66C6A0' : '#8792a0' }));

  if (scene.telop) parts.push(renderTelop(scene.telop.text, t, scene.telop.at));
  parts.push(renderSection(scene.section));
  const a = appear(localT, 0.15, 0.3);
  parts.push(renderSubtitle(turn.speaker, turn.text, a.o));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}
