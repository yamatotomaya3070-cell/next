// シーンのタイミング計算＋立ち絵の表情マッピング。build_materials.mjs / build_manual.mjs で共有。
//   render_project.mjs と同じ head/gap/tail でスケジュールを組むので、完成見本と時間が一致する。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export const HEAD = 0.4, GAP = 0.28, TAIL = 0.5;
export const SPEAKER_JA = { narrator: 'ナレーション', haru: 'ハル', mina: 'ミナ先生' };

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
export function sceneSchedule(scene, voxDir, tag) {
  const lines = [];
  let cur = HEAD;
  (scene.audio || []).forEach((a, li) => {
    const file = `${voxDir}/s${tag}_l${li}.wav`;
    const d = probe(file) || 1.5;
    lines.push({ li, speaker: a.speaker, text: a.text, emotion: a.emotion, emphasis: a.emphasis || [], start: cur, end: cur + d, file });
    cur += d + GAP;
  });
  const D = Math.max(2.5, cur - GAP + TAIL);
  return { D, lines };
}

// mm:ss.d 形式（DaVinci のタイムコード相談用に読みやすく）
export function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}
