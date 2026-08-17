// SCENE.visual.infographic 相当のデータ（04のschema候補に対応）。
// これがそのまま「AIが生成するシーン設計図」の入力になる想定。

export const scene041 = {
  id: 'scene_041',
  type: 'comparison',
  durationSec: 7.5,
  title: '利益10万円、どっちが得？',
  columns: [
    {
      label: '通常口座', tone: 'muted',
      rows: [
        { k: '利益', v: '+100,000円' },
        { k: '税金', v: '−20,315円', tone: 'warn' },
        { k: '手取り', v: '79,685円' },
      ],
    },
    {
      label: 'NISA', tone: 'accent',
      rows: [
        { k: '利益', v: '+100,000円' },
        { k: '税金', v: '0円', emph: true, tone: 'good' },
        { k: '手取り', v: '100,000円', tone: 'good' },
      ],
    },
  ],
  reveal: {
    title: 0.2, colLeft: 0.9, colRight: 2.7,
    rows: { normal: [1.3, 1.8, 2.3], nisa: [3.1, 3.9, 4.6] },
    emph: 3.9, warm: 4.9,
  },
  caption: '※税率20.315%（所得税15％＋復興特別所得税0.315％＋住民税5％）・利益10万円の例',
};

// chart: 積立20年の資産推移（元本 vs 運用5%・複利）。points は万円。
function accumSeries(rate) {
  const pts = []; const i = rate / 12; let bal = 0;
  for (let y = 0; y <= 20; y++) {
    if (y > 0) for (let m = 0; m < 12; m++) bal = (bal + 1) * (1 + i); // 1万円/月
    pts.push({ x: y, y: Math.round(bal) });
  }
  return pts;
}
export const scene046 = {
  id: 'scene_046',
  type: 'chart',
  durationSec: 6,
  headline: '毎月1万円・20年の資産推移',
  x: { min: 0, max: 20, ticks: [0, 5, 10, 15, 20], suffix: '年' },
  yMax: 450, yStep: 100, yUnit: '万円',
  series: [
    { name: '運用（利回り5%）', color: '#37d39a', area: true, prefix: '約', points: accumSeries(0.05) },
    { name: '元本のみ', color: '#8aa0a6', area: false, points: Array.from({ length: 21 }, (_, y) => ({ x: y, y: 12 * y })) },
  ],
  note: '※想定利回り5%のシミュレーション例。運用成果を保証するものではありません',
  reveal: { headline: 0.2, draw: [0.9, 4.2], callout: 4.2 },
};

// timeline: NISA制度の変遷
export const scene024 = {
  id: 'scene_024',
  type: 'timeline',
  durationSec: 6,
  headline: 'NISA制度のうつりかわり',
  points: [
    { year: '2014', label: '一般NISA 開始' },
    { year: '2018', label: 'つみたてNISA' },
    { year: '2024', label: '新NISA恒久化・枠拡大', emph: true },
  ],
  note: '2024年から制度が恒久化。つみたて枠と成長枠の2本立てに',
  reveal: { headline: 0.2, nodes: [1.0, 2.2, 3.6], emphAt: 3.6 },
};

// process: 口座開設の3ステップ
export const scene070 = {
  id: 'scene_070',
  type: 'process',
  durationSec: 5.5,
  headline: 'はじめ方は、3ステップ',
  steps: [
    { n: 1, title: '証券会社を選ぶ', desc: 'ネット証券が手軽でおすすめ' },
    { n: 2, title: '口座を申し込む', desc: '本人確認書類とマイナンバー' },
    { n: 3, title: '積立を設定', desc: '毎月の金額と銘柄を決める' },
  ],
  note: '最初の一歩は「口座を開く」だけ',
  reveal: { headline: 0.2, steps: [0.9, 2.0, 3.1] },
};

export const scene002 = {
  id: 'scene_002',
  type: 'number_animation',
  durationSec: 5,
  headline: '毎月1万円を20年つづけると…',
  count: { from: 0, to: 1710000, prefix: '差額 +約', suffix: '円' },
  sub: '積立20年・想定利回り5%の場合（例）',
  note: '※シミュレーション例。将来の運用成果を保証するものではありません',
  reveal: { headline: 0.2, countStart: 0.9, countEnd: 3.6, sub: 3.7, pop: 3.6 },
};
