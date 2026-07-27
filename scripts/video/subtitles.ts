/**
 * 字幕生成（工程: generating_subtitles）
 * タイミングはAIの推測ではなく、生成済み音声の実測尺から算出する。
 * テンプレート非依存: AudioScene[] + VoiceProfile[] + subtitleStyle設定を受け取り、
 * 共通形の TemplateTimeline / SRT / 色分けASS / 結合ナレーション音声を出力する。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AudioScene, VoiceProfile } from "../../src/lib/video/templates";
import type { TemplateSceneTiming, TemplateTimeline } from "../../src/lib/video/templates/types";
import type { SceneAudio } from "./tts";
import { run } from "./exec";

export const SCENE_GAP_SEC = 0.35;

export interface SubtitleStyle {
  maxCharsPerLine: number;
  maxLines: number;
  fontSize: number;
  marginBottom: number;
}

export function wrapSubtitle(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  let rest = text.trim();
  while (rest.length > 0) {
    if (rest.length <= maxCharsPerLine) {
      lines.push(rest);
      break;
    }
    let cut = maxCharsPerLine;
    for (let i = maxCharsPerLine; i > maxCharsPerLine - 8 && i > 0; i--) {
      if ("、。！？!?」".includes(rest[i - 1])) {
        cut = i;
        break;
      }
    }
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return lines;
}

function splitEvents(
  narration: string,
  startSec: number,
  endSec: number,
  style: SubtitleStyle,
): Array<{ lines: string[]; startSec: number; endSec: number }> {
  const allLines = wrapSubtitle(narration, style.maxCharsPerLine);
  const chunks: string[][] = [];
  for (let i = 0; i < allLines.length; i += style.maxLines) {
    chunks.push(allLines.slice(i, i + style.maxLines));
  }
  const totalChars = allLines.join("").length || 1;
  const events: Array<{ lines: string[]; startSec: number; endSec: number }> = [];
  let cursor = startSec;
  for (const chunk of chunks) {
    const ratio = chunk.join("").length / totalChars;
    const duration = (endSec - startSec) * ratio;
    events.push({ lines: chunk, startSec: cursor, endSec: cursor + duration });
    cursor += duration;
  }
  if (events.length > 0) events[events.length - 1].endSec = endSec;
  return events;
}

/** 音声実測尺からタイムラインを構築する（無音セグメントも尺として計上、字幕は出さない） */
export function buildTimeline(
  scenes: AudioScene[],
  profiles: VoiceProfile[],
  audios: SceneAudio[],
  style: SubtitleStyle,
): TemplateTimeline {
  const byScene = new Map(audios.map((a) => [a.sceneId, a]));
  const timingScenes: TemplateSceneTiming[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    const audio = byScene.get(scene.id);
    if (!audio) throw new Error(`シーン ${scene.id} の音声がありません`);
    const profile = profiles.find((p) => p.id === scene.voiceId);
    const startSec = Math.round(cursor * 100) / 100;
    const endSec = Math.round((cursor + audio.durationSec) * 100) / 100;
    timingScenes.push({
      sceneId: scene.id,
      order: scene.order,
      narration: scene.narration,
      startSec,
      endSec,
      audioFile: `audio/${audio.file}`,
      subtitleLines: scene.narration ? wrapSubtitle(scene.narration, style.maxCharsPerLine) : [],
      speakerLabel: profile?.label ?? scene.voiceId,
      subtitleColor: profile?.subtitleColor ?? "#334155",
    });
    cursor = endSec + SCENE_GAP_SEC;
  }
  return { totalDurationSec: Math.round((cursor - SCENE_GAP_SEC) * 100) / 100, scenes: timingScenes };
}

function srtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function assTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec % 1) * 100);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function assColor(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}`.toUpperCase();
}

export function buildSrt(timeline: TemplateTimeline, style: SubtitleStyle): string {
  const blocks: string[] = [];
  let index = 1;
  for (const scene of timeline.scenes) {
    if (!scene.narration) continue;
    for (const ev of splitEvents(scene.narration, scene.startSec, scene.endSec, style)) {
      blocks.push(`${index}\n${srtTime(ev.startSec)} --> ${srtTime(ev.endSec)}\n${ev.lines.join("\n")}\n`);
      index += 1;
    }
  }
  return blocks.join("\n");
}

/** 話者ごとに色分けした焼き込み用ASS字幕（画面下部の安全領域内に表示） */
export function buildAss(
  timeline: TemplateTimeline,
  profiles: VoiceProfile[],
  style: SubtitleStyle,
  width: number,
  height: number,
): string {
  // ASS字幕のフォント名（libass が fontconfig で解決する family 名）。
  // 既定は Windows の Meiryo。Docker/Linux では VIDEO_FONT_NAME で
  // 同梱フォントの family 名（例: "Noto Sans CJK JP"）へ差し替える。
  const fontName = process.env.VIDEO_FONT_NAME ?? "Meiryo";
  const styles = profiles
    .map(
      (p) =>
        `Style: ${p.id},${fontName},${style.fontSize},${assColor(p.subtitleColor)},&H000000FF,&H00FFFFFF,&H7F000000,-1,0,0,0,100,100,0,0,1,4,2,2,${Math.round(width * 0.06)},${Math.round(width * 0.06)},${style.marginBottom},1`,
    )
    .join("\n");

  const events: string[] = [];
  for (const scene of timeline.scenes) {
    if (!scene.narration) continue;
    const speakerStyleId = profiles.find((p) => p.label === scene.speakerLabel)?.id ?? profiles[0]?.id ?? "narrator";
    for (const ev of splitEvents(scene.narration, scene.startSec, scene.endSec, style)) {
      events.push(`Dialogue: 0,${assTime(ev.startSec)},${assTime(ev.endSec)},${speakerStyleId},,0,0,0,,${ev.lines.join("\\N")}`);
    }
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styles}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

export interface SubtitleArtifacts {
  timeline: TemplateTimeline;
  srtPath: string;
  assPath: string;
  narrationPath: string;
}

/**
 * タイムライン・字幕ファイル・結合ナレーション音声を生成する。
 * variantDir: 同一ジョブ内で複数系統（例: interview_editの「未編集フル」と「keepのみ見本」）を
 * 別ディレクトリに分けて生成したいときに指定する（既定 "subtitles"）。
 */
export function generateSubtitles(
  scenes: AudioScene[],
  profiles: VoiceProfile[],
  audios: SceneAudio[],
  style: SubtitleStyle,
  width: number,
  height: number,
  workdir: string,
  variantDir = "subtitles",
): SubtitleArtifacts {
  const subsDir = join(workdir, variantDir);
  mkdirSync(subsDir, { recursive: true });

  const timeline = buildTimeline(scenes, profiles, audios, style);
  writeFileSync(join(subsDir, "timeline.json"), JSON.stringify(timeline, null, 2), "utf8");
  writeFileSync(join(subsDir, "subtitles.srt"), buildSrt(timeline, style), "utf8");
  writeFileSync(join(subsDir, "subtitles.ass"), buildAss(timeline, profiles, style, width, height), "utf8");

  run(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(SCENE_GAP_SEC), "gap.wav"],
    subsDir,
  );
  const listLines = audios.flatMap((a, i) => [
    `file '../voices/${a.file}'`,
    ...(i < audios.length - 1 ? ["file 'gap.wav'"] : []),
  ]);
  writeFileSync(join(subsDir, "concat.txt"), listLines.join("\n"), "utf8");
  run(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "narration.wav"],
    subsDir,
  );

  return {
    timeline,
    srtPath: join(subsDir, "subtitles.srt"),
    assPath: join(subsDir, "subtitles.ass"),
    narrationPath: join(subsDir, "narration.wav"),
  };
}
