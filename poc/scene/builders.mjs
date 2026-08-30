// SCENE.visual → 図解ビルダー（純粋関数群）。render_project.mjs と build_materials.mjs で共有。
//   ここには「図解の中身」だけを持つ。テロップ/字幕/セクション見出しのオーバーレイは
//   呼び出し側が overlay.mjs の inject() で重ねる（＝素材書き出しはオーバーレイを外せば no-telop になる）。
import { T, text, roundRect, appear, easeOut, clamp, commas, boardBG, chalkBox } from '../infographic/shared.mjs';
import { estWidth } from '../infographic/overlay.mjs';
import { buildNumberSVG } from '../infographic/number.mjs';
import { buildComparisonSVG } from '../infographic/comparison.mjs';
import { buildProcessSVG } from '../infographic/process.mjs';
import { buildTimelineSVG } from '../infographic/timeline.mjs';
import { buildChartSVG } from '../infographic/chart.mjs';
import { buildConversationSVG } from '../infographic/conversation.mjs';
import { buildKeywordsSVG } from '../infographic/title.mjs';

export const W = 1280, H = 720;
export const SECTION_JA = { hook: 'フック', problem: '問題提起', basics: '基礎説明', example: '具体例', dialogue: '疑問と誤解', caution: '注意点', summary: 'まとめ', cta: 'はじめ方' };

// テキストが maxW に収まる最大サイズ
export function fitSize(s, maxW, base, min = 22) { let sz = base; while (sz > min && estWidth(String(s), sz) > maxW) sz -= 2; return sz; }
export function hexA(h, a) { const n = h.replace('#', ''); return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`; }

// reveal タイミングを尺Dから自動生成
export const spread = (n, a, b) => Array.from({ length: n }, (_, i) => n === 1 ? a : a + (b - a) * (i / (n - 1)));

// 文字列を最大行数・1行あたり文字数で折り返す（日本語=空白なしなので文字数で）
export function wrapJa(s, perLine, maxLines) {
  const clean = String(s || '').replace(/\s+/g, ' ').trim();
  const lines = [];
  for (let i = 0; i < clean.length && lines.length < maxLines; i += perLine) lines.push(clean.slice(i, i + perLine));
  if (lines.length === maxLines && clean.length > perLine * maxLines) lines[maxLines - 1] = lines[maxLines - 1].slice(0, perLine - 1) + '…';
  return lines;
}

// キリのよい上限
export function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// まとめ（要点チェックリスト）。onScreenText を要点として縦に並べ、順に✓が付く。
export function buildRecapSVG(scene) {
  const W2 = 1280, H2 = 720;
  const points = (scene.visual.onScreenText || []).filter(Boolean).slice(0, 4);
  return (t) => {
    const parts = [boardBG('rcbg')];
    const ha = appear(t, 0.2, 0.5);
    parts.push(text(W2 / 2, 130 - ha.dy, '今日のまとめ', { anchor: 'middle', size: 46, weight: 800, fill: '#ffffff', opacity: ha.o }));
    const n = points.length;
    const rowH = 92, startY = 250 + (Math.max(0, 3 - n)) * 20;
    const leftX = 250, textX = leftX + 56, maxTextW = W2 - textX - 120;
    points.forEach((p, i) => {
      const a = appear(t, 0.6 + i * 0.5, 0.4);
      if (a.o <= 0) return;
      const y = startY + i * rowH - a.dy;
      parts.push(chalkBox(leftX - 30, y - 34, W2 - leftX * 2 + 60, 68, 16, { opacity: a.o }));
      parts.push(`<circle cx="${leftX}" cy="${y}" r="20" fill="${T.chalkWarm}" opacity="${a.o}"/>`);
      parts.push(text(leftX, y + 8, '✓', { anchor: 'middle', size: 24, weight: 800, fill: '#2f5233', opacity: a.o }));
      const sz = fitSize(p, maxTextW, 40, 24);
      parts.push(text(textX, y + sz / 3, p, { anchor: 'start', size: sz, weight: 700, fill: '#ffffff', opacity: a.o }));
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H2}" viewBox="0 0 ${W2} ${H2}">${parts.join('')}</svg>`;
  };
}

// 棒グラフ（bar/pie 用・自前アニメ）
export function buildBarChartSVG(scene, t) {
  const bars = scene.bars.slice(0, 6);
  const W2 = 1280, H2 = 720, X0 = 200, X1 = 1080, YB = 580, YT = 210;
  const yMax = niceMax(Math.max(1, ...bars.map((b) => Math.abs(b.value))));
  const parts = [boardBG('brbg')];
  const ha = appear(t, 0.2, 0.5);
  parts.push(text(W2 / 2, 120 - ha.dy, scene.headline, { anchor: 'middle', size: 42, weight: 800, opacity: ha.o }));
  for (let k = 0; k <= 4; k++) { const y = YB - (YB - YT) * (k / 4); parts.push(`<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="${T.line}" stroke-width="1" opacity="0.4"/>`); }
  const n = bars.length, slot = (X1 - X0) / n, bw = Math.min(150, slot * 0.55);
  bars.forEach((b, i) => {
    const cx = X0 + slot * (i + 0.5);
    const grow = clamp(easeOut((t - (0.5 + i * 0.15)) / 0.6));
    const full = (Math.abs(b.value) / yMax) * (YB - YT);
    const h = full * grow;
    const isLast = i === n - 1;
    const color = isLast ? T.good : (i % 2 ? '#6b8f9a' : '#8aa0a6');
    parts.push(`<rect x="${(cx - bw / 2).toFixed(1)}" y="${(YB - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="8" fill="${color}"/>`);
    const va = appear(t, 0.5 + i * 0.15 + 0.5, 0.4);
    parts.push(text(cx, YB - h - 16, `${commas(b.value)}`, { anchor: 'middle', size: 30, weight: 800, fill: color, opacity: va.o }));
    parts.push(text(cx, YB + 40, String(b.label).slice(0, 10), { anchor: 'middle', size: 26, weight: 600, fill: T.sub }));
  });
  if (scene.note) parts.push(text(W2 / 2, H2 - 30, scene.note, { anchor: 'middle', size: 22, fill: T.sub, opacity: 0.8 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H2}" viewBox="0 0 ${W2} ${H2}">${parts.join('')}</svg>`;
}

// 概念図（infographic 用・ノードを線でつなぎ順に出現）
export function buildConceptSVG(scene) {
  const v = scene.visual;
  const nodes = (v.onScreenText || []).slice(0, 4);
  return (t) => {
    const W2 = 1280, H2 = 720;
    const parts = [boardBG('cpbg'),
      `<defs><marker id="arw" markerWidth="12" markerHeight="12" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${T.accent}"/></marker></defs>`];
    // ※ description は演出メモ(編集者向け)なので画面に出さない。ノード(onScreenText)で見せる。
    if (nodes.length) {
      const cy = 360, bw = 300, bh = 100, gap = (W2 - nodes.length * bw) / (nodes.length + 1);
      const xs = nodes.map((_, i) => gap + i * (bw + gap) + bw / 2);
      for (let i = 1; i < nodes.length; i++) {
        const a = appear(t, 0.6 + i * 0.4, 0.3);
        parts.push(`<line x1="${xs[i - 1] + bw / 2 + 4}" y1="${cy}" x2="${xs[i] - bw / 2 - 12}" y2="${cy}" stroke="${T.accent}" stroke-width="4" marker-end="url(#arw)" opacity="${a.o}"/>`);
      }
      nodes.forEach((tp, i) => {
        const a = appear(t, 0.5 + i * 0.4, 0.4);
        parts.push(chalkBox(xs[i] - bw / 2, cy - bh / 2 - a.dy, bw, bh, 16, { opacity: a.o }));
        wrapJa(tp, 12, 2).forEach((ln, k, arr) => parts.push(text(xs[i], cy - (arr.length - 1) * 15 + k * 30 - a.dy, ln, { anchor: 'middle', size: 26, weight: 700, fill: '#ffffff', opacity: a.o })));
      });
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H2}" viewBox="0 0 ${W2} ${H2}">${parts.join('')}</svg>`;
  };
}

// 汎用カード（character_explanation/generated_video/broll など）
// description は「演出メモ(編集者向け)」なので画面に出さない。onScreenText(テロップ)を主役にする。
export function genericCard(scene) {
  const v = scene.visual;
  const tels = (v.onScreenText || []).filter(Boolean).slice(0, 3);
  return (t) => {
    const parts = [boardBG('gc')];
    if (tels.length) {
      const ha = appear(t, 0.2, 0.5);
      wrapJa(tels[0], 16, 2).forEach((ln, i, arr) =>
        parts.push(text(W / 2, 250 - (arr.length - 1) * 30 + i * 60 - ha.dy, ln, { anchor: 'middle', size: 52, weight: 800, fill: '#ffffff', opacity: ha.o })));
      tels.slice(1).forEach((tp, i) => {
        const b = appear(t, 0.7 + i * 0.35, 0.4);
        parts.push(chalkBox(W / 2 - 240, 380 + i * 72 - b.dy, 480, 56, 28, { opacity: b.o }));
        parts.push(text(W / 2, 417 + i * 72 - b.dy, String(tp).slice(0, 20), { anchor: 'middle', size: 28, weight: 700, fill: '#ffffff', opacity: b.o }));
      });
    } else {
      const a = appear(t, 0.15, 0.5);
      wrapJa(v.description, 20, 2).forEach((ln, i, arr) =>
        parts.push(text(W / 2, 300 - (arr.length - 1) * 28 + i * 56, ln, { anchor: 'middle', size: 40, weight: 800, fill: '#ffffff', opacity: a.o })));
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
  };
}

// 会話用: audio[] を convScene.turns に
export function convFrame(scene, sched) {
  const turns = sched.map((x) => ({ speaker: x.line.speaker, start: x.start, dur: x.end - x.start + 0.05, text: x.line.text, emotion: x.line.emotion }));
  const conv = { section: SECTION_JA[scene.section] || '会話', telop: (scene.visual.onScreenText || [])[0] ? { text: scene.visual.onScreenText[0], at: (turns[1]?.start ?? turns[0].start) + 0.3 } : null, turns };
  return (t) => buildConversationSVG(conv, t);
}

// visual.type → 既存ビルダー＋データ変換。未対応型は null（呼び出し側で genericCard）。
export function adaptBuilder(scene, D) {
  const v = scene.visual, info = v.infographic;
  const telop0 = (v.onScreenText || [])[0] || (v.description || '').slice(0, 26);
  switch (v.type) {
    case 'number_animation': {
      const i = info && info.kind === 'number_animation' ? info : { from: 0, to: 0, unit: '' };
      const s = { headline: telop0, count: { from: i.from, to: i.to, prefix: '', suffix: i.unit || '' }, sub: (v.onScreenText || [])[1] || '', note: '',
        reveal: { headline: 0.2, countStart: 0.7, countEnd: Math.max(1.5, D * 0.62), sub: D * 0.64, pop: Math.max(1.5, D * 0.62) } };
      return (t) => buildNumberSVG(s, t);
    }
    case 'comparison': {
      const i = info && info.kind === 'comparison' ? info : { left: '', right: '', rows: [], emphasis: null };
      const rows = i.rows.length ? i.rows : [{ label: '', leftValue: '', rightValue: '' }];
      const s = { title: telop0,
        columns: [
          { label: i.left || '通常', tone: 'muted', rows: rows.map((r) => ({ k: r.label, v: r.leftValue })) },
          { label: i.right || 'NISA', tone: 'accent', rows: rows.map((r) => ({ k: r.label, v: r.rightValue, emph: i.emphasis && r.rightValue === i.emphasis ? true : undefined, tone: /0円|ゼロ/.test(r.rightValue || '') ? 'good' : undefined })) },
        ],
        reveal: { title: 0.2, colLeft: 0.6, colRight: Math.min(1.8, D * 0.28), rows: { normal: spread(rows.length, 1.0, D * 0.4), nisa: spread(rows.length, D * 0.45, D * 0.72) }, emph: D * 0.6, warm: D * 0.74 },
        caption: '' };
      return (t) => buildComparisonSVG(s, t);
    }
    case 'process': {
      const steps = (info && info.kind === 'process' ? info.steps : []).slice(0, 4);
      const arr = steps.length ? steps : [{ title: telop0, detail: '' }];
      const s = { headline: (v.description || 'はじめ方').slice(0, 20), steps: arr.map((st, i) => ({ n: i + 1, title: st.title, desc: st.detail })), note: (v.onScreenText || [])[0] || '',
        reveal: { headline: 0.2, steps: spread(arr.length, 0.7, Math.max(1.2, D * 0.7)) } };
      return (t) => buildProcessSVG(s, t);
    }
    case 'timeline': {
      const pts = (info && info.kind === 'timeline' ? info.points : []).slice(0, 5);
      const arr = pts.length ? pts : [{ year: '', label: telop0 }];
      const s = { headline: (v.description || '制度の変遷').slice(0, 20), points: arr.map((p, i) => ({ year: p.year, label: p.label, emph: i === arr.length - 1 })), note: '',
        reveal: { headline: 0.2, nodes: spread(arr.length, 0.8, Math.max(1.4, D * 0.7)), emphAt: Math.max(1.4, D * 0.7) } };
      return (t) => buildTimelineSVG(s, t);
    }
    case 'chart': {
      const i = info && info.kind === 'chart' ? info : null;
      const series = (i?.series || []).filter((s) => Array.isArray(s.points) && s.points.length);
      if (!series.length) return null;
      if (i.chartKind === 'line' || i.chartKind === 'area') {
        const maxLen = Math.max(...series.map((s) => s.points.length));
        const allMax = Math.max(1, ...series.flatMap((s) => s.points));
        const yMax = niceMax(allMax);
        const palette = [T.good, '#8aa0a6', T.accent];
        const s2 = { headline: telop0, note: '',
          x: { min: 0, max: Math.max(1, maxLen - 1), ticks: Array.from(new Set(spread(Math.min(5, maxLen), 0, maxLen - 1).map(Math.round))), suffix: '' },
          yMax, yStep: yMax / 4, yUnit: '',
          series: series.map((s, k) => ({ name: s.label, color: palette[k % palette.length], area: k === 0, points: s.points.map((y, x) => ({ x, y })) })),
          reveal: { headline: 0.2, draw: [0.9, Math.max(2, D * 0.7)], callout: Math.max(2, D * 0.7) } };
        return (t) => buildChartSVG(s2, t);
      }
      const bars = series.length > 1
        ? series.map((s) => ({ label: s.label, value: s.points[s.points.length - 1] }))
        : series[0].points.map((val, x) => ({ label: `${x + 1}`, value: val }));
      const bs = { headline: telop0, bars, note: '' };
      return (t) => buildBarChartSVG(bs, t);
    }
    case 'infographic':
      return buildConceptSVG(scene);
    case 'recap':
      return buildRecapSVG(scene);
    case 'text_emphasis': {
      const words = (v.onScreenText || []).filter(Boolean).slice(0, 3);
      const longish = words.some((w) => [...String(w)].length > 6);
      if (!words.length || longish) return null;
      const s = { headline: '', words, note: '' };
      return (t) => buildKeywordsSVG(s, t);
    }
    default:
      return null;
  }
}
