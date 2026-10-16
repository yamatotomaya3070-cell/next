// シーンのタイミング計算＋立ち絵の表情マッピング。render_project.mjs / build_materials.mjs で共有。
//   セリフの置き場所はすべて「フレーム（1/24秒）」の整数で決める。DaVinci の「絆_素材を並べる.lua」と
//   src/lib/scene/arrangeSimulation.ts も同じ式なので、完成見本・自動配置・作業指示一覧が1フレームも違わない。
//   （秒のまま足すと、Resolve がセリフの長さをフレームに切り捨てる分だけ後ろのセリフほど早くずれる）
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export const FPS = 24;
// 場面の頭の間・セリフとセリフの間・場面の終わりの間（フレーム）
export const HEAD_F = 10, GAP_F = 7, TAIL_F = 12;
// 声の無い場面でも最低これだけは映す（フレーム）
export const MIN_SCENE_F = 60;

// Resolve と同じ数え方: 音声のフレーム数は「秒数×24」の切り捨て
export const audioFramesOf = (sec) => Math.floor(sec * FPS + 1e-6);

// セリフの長さ（秒）の並び → 各セリフの開始フレーム・長さと、場面の長さ（フレーム）
export function frameSchedule(durations) {
  let cur = HEAD_F;
  let end = 0;
  const lines = durations.map((d) => {
    const lenF = audioFramesOf(d);
    const startF = cur;
    end = startF + lenF;
    cur = end + GAP_F;
    return { startF, lenF };
  });
  const sceneF = Math.max(MIN_SCENE_F, lines.length ? end + TAIL_F : 0);
  return { lines, sceneF };
}
// 支給するセリフ音声の前後に足す無音（フレーム）。タイムラインでセリフのクリップを
//   すき間なくつなげて並べたとき、ちょうど完成見本と同じ位置で声が出るようにする。
//   （編集の決まりとして、音声トラックはクリップの間を空けずに詰めて並べる。「間」は音声ファイルの中の無音で持つ）
//   scenes: [{ sceneF, lines:[{startF,lenF}] }] → 場面ごと・セリフごとの { leadF, trailF }
//   本編で最初のセリフだけ前に無音を足して本編の頭から始め、ほかは後ろに「次のセリフの頭まで」の無音を足す。
export function voicePadding(scenes) {
  const flat = [];
  let off = 0;
  scenes.forEach((sc, si) => {
    sc.lines.forEach((ln, li) => flat.push({ si, li, start: off + ln.startF, end: off + ln.startF + ln.lenF }));
    off += sc.sceneF;
  });
  const out = scenes.map((sc) => sc.lines.map(() => ({ leadF: 0, trailF: 0 })));
  flat.forEach((v, k) => {
    const next = k + 1 < flat.length ? flat[k + 1].start : off;
    out[v.si][v.li] = { leadF: k === 0 ? v.start : 0, trailF: next - v.end };
  });
  return out;
}
export const SPEAKER_JA ={ narrator: 'ナレーション', haru: 'ハル', mina: 'ミナ先生' };

// emotion → 立ち絵ファイル名（conversation.mjs と同一マップ）
const HARU_MAP = { neutral: 'neutral', curious: 'curious', tension: 'thinking', positive_surprise: 'surprised', surprise: 'surprised', realization: 'understood', puzzled: 'worried', calm_warm: 'neutral', serious: 'worried', gentle_warning: 'worried', warm: 'happy', bright_confident: 'happy', encouraging: 'happy' };
const MINA_MAP = { neutral: 'neutral', curious: 'explaining', tension: 'explaining', positive_surprise: 'positive', surprise: 'positive', realization: 'positive', puzzled: 'thinking', calm_warm: 'explaining', serious: 'caution', gentle_warning: 'caution', warm: 'reassuring', bright_confident: 'positive', encouraging: 'positive' };
export function exprFor(speaker, emotion) {
  if (speaker === 'haru') return `haru_${HARU_MAP[emotion] || 'neutral'}`;
  if (speaker === 'mina') return `mina_${MINA_MAP[emotion] || 'neutral'}`;
  return null; // ナレーションは立ち絵なし
}

export function probe(p) {
  if (!existsSync(p)) return 0;
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p], { encoding: 'utf8' });
  return parseFloat(r.stdout.trim()) || 0;
}

// 1シーンのスケジュール。voxDir に s{tag}_l{li}.wav がある前提（無ければ d=1.5 と仮定）。
//   start/end は秒（start は開始フレーム÷24、end は声が実際に終わる時刻）。D は場面の長さ（秒）。
export function sceneSchedule(scene, voxDir, tag) {
  const audio = scene.audio || [];
  const files = audio.map((_, li) => `${voxDir}/s${tag}_l${li}.wav`);
  const durations = files.map((file) => probe(file) || 1.5);
  const { lines: frames, sceneF } = frameSchedule(durations);
  const lines = audio.map((a, li) => ({
    li, speaker: a.speaker, text: a.text, emotion: a.emotion, emphasis: a.emphasis || [],
    startF: frames[li].startF, lenF: frames[li].lenF,
    start: frames[li].startF / FPS, end: frames[li].startF / FPS + durations[li], file: files[li],
  }));
  return { D: sceneF / FPS, sceneF, lines };
}

// mm:ss.d 形式（DaVinci のタイムコード相談用に読みやすく）
export function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}
