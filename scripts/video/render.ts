/**
 * 完成見本レンダリング（工程: rendering_preview）
 * テンプレート非依存の汎用レンダラー。背景 + （あれば）立ち絵の話者切替・表情切替 +
 * （あれば）タイトル/カードテキスト/話者名タグ + 色分け字幕 + BGM を ffmpeg で機械的に合成する。
 * AIは使わない。テンプレート固有の見た目の違いは RenderSceneInfo の中身だけで表現する。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RenderSceneInfo } from "../../src/lib/video/templates";
import type { TemplateTimeline } from "../../src/lib/video/templates/types";
import { probeStreams, run, type ProbeStreams } from "./exec";

const FPS = 30;
// 焼き込みテキスト用フォント（ffmpeg drawtext の fontfile）。
// 既定は開発機(Windows)の meiryo。Docker/Linux では VIDEO_FONT_FILE で
// 同梱フォント(例: Noto Sans CJK)のパスへ差し替える。
// ffmpeg のフィルタ構文ではドライブレターのコロンをエスケープする必要がある。
const FONT = (process.env.VIDEO_FONT_FILE ?? "C:/Windows/Fonts/meiryo.ttc").replace(/:/g, "\\:");

export interface RenderInput {
  scenes: RenderSceneInfo[];
  timeline: TemplateTimeline;
  workdir: string;
  assetsDir: string;
  width: number;
  height: number;
  backgroundFile: string; // 静止画: assetsDir内のファイル名 / 動画(backgroundIsVideo): 絶対パス
  backgroundIsVideo?: boolean; // trueなら背景を実写Bロール動画として扱う（WxH済み・-stream_loopで尺を充填）
  outName?: string; // workdir内の相対出力パス（既定: render/sample.mp4）
  subtitlesDir?: string; // subtitles.generateSubtitles の variantDir と対応させる（既定: "subtitles"）
}

function betweenSum(windows: Array<{ startSec: number; endSec: number }>): string {
  if (windows.length === 0) return "0";
  return windows.map((w) => `between(t,${w.startSec.toFixed(2)},${w.endSec.toFixed(2)})`).join("+");
}

export interface RenderResult {
  videoPath: string;
  probe: ProbeStreams;
}

export function renderVideo(input: RenderInput): RenderResult {
  const { scenes, timeline, workdir, assetsDir, width, height } = input;
  const renderDir = join(workdir, "render");
  mkdirSync(renderDir, { recursive: true });
  const abs = (name: string) => resolve(assetsDir, name);
  const timingBySceneId = new Map(timeline.scenes.map((s) => [s.sceneId, s]));

  const windowsFor = (predicate: (s: RenderSceneInfo) => boolean) =>
    scenes
      .filter(predicate)
      .map((s) => timingBySceneId.get(s.id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ startSec: t.startSec, endSec: t.endSec }));

  // ---- 入力: 0=背景 / 1=ナレーション / 2=BGM / 3以降=立ち絵 ----
  // 背景は静止画(-loop 1)か実写Bロール動画(-stream_loop -1で尺充填)。動画はWxH済みの絶対パス。
  const subtitlesDir = input.subtitlesDir ?? "subtitles";
  const bgInput = input.backgroundIsVideo
    ? ["-stream_loop", "-1", "-i", input.backgroundFile]
    : ["-loop", "1", "-i", abs(input.backgroundFile)];
  const inputs: string[] = [
    ...bgInput,
    "-i", `${subtitlesDir}/narration.wav`,
    "-stream_loop", "-1", "-i", abs("bgm_loop.wav"),
  ];
  let inputIndex = 3;
  const filterParts: string[] = [];
  const overlayLabels: Array<{ label: string; x: number; enable: string }> = [];
  const scale = width / 1920;
  const charHeight = Math.round(560 * scale) || 420;
  const marginX = Math.round(90 * scale);

  const characterKeys = [...new Set(scenes.map((s) => s.characterKey).filter((k): k is "ao" | "midori" => Boolean(k)))];
  for (const key of characterKeys) {
    const ofKey = scenes.filter((s) => s.characterKey === key);
    const position = ofKey[0]?.characterPosition ?? "left";
    const x = position === "left" ? marginX : width - marginX - Math.round(420 * scale);

    const dimLabel = `${key}_dim`;
    inputs.push("-i", abs(`${key}_normal.png`));
    filterParts.push(`[${inputIndex}:v]scale=-1:${charHeight},eq=brightness=-0.18:saturation=0.6[${dimLabel}]`);
    overlayLabels.push({ label: dimLabel, x, enable: `lt(${betweenSum(windowsFor((s) => s.characterKey === key))},0.5)` });
    inputIndex += 1;

    const expressions = [...new Set(ofKey.map((s) => s.characterExpression).filter(Boolean))] as string[];
    for (const expression of expressions) {
      const label = `${key}_${expression}`;
      inputs.push("-i", abs(`${key}_${expression}.png`));
      filterParts.push(`[${inputIndex}:v]scale=-1:${charHeight}[${label}]`);
      overlayLabels.push({
        label,
        x,
        enable: betweenSum(windowsFor((s) => s.characterKey === key && s.characterExpression === expression)),
      });
      inputIndex += 1;
    }
  }

  const charBottomY = height - charHeight - Math.round(30 * scale);
  let last = "0:v";
  for (const [i, ov] of overlayLabels.entries()) {
    const out = `v${i}`;
    filterParts.push(`[${last}][${ov.label}]overlay=x=${ov.x}:y=${charBottomY}:enable='${ov.enable}'[${out}]`);
    last = out;
  }

  // ---- テキスト: タイトル/カード（cardTitle=見出し, cardText=本文） / 話者名タグ ----
  const drawtexts: string[] = [];
  const titleY = Math.round(height * 0.14);
  const cardTextY = Math.round(height * 0.34);
  const tagY = Math.round(height * 0.1);
  for (const [i, scene] of scenes.entries()) {
    const t = timingBySceneId.get(scene.id);
    if (!t) continue;
    const enable = `between(t,${t.startSec.toFixed(2)},${t.endSec.toFixed(2)})`;
    if (scene.cardTitle) {
      const file = `title_${String(i).padStart(3, "0")}.txt`;
      writeFileSync(join(renderDir, file), scene.cardTitle, "utf8");
      drawtexts.push(
        `drawtext=fontfile='${FONT}':textfile=render/${file}:fontcolor=0x333333:fontsize=${Math.round(64 * scale) || 44}:x=(w-text_w)/2:y=${titleY}:enable='${enable}'`,
      );
    }
    if (scene.cardText) {
      const file = `card_${String(i).padStart(3, "0")}.txt`;
      writeFileSync(join(renderDir, file), scene.cardText, "utf8");
      drawtexts.push(
        `drawtext=fontfile='${FONT}':textfile=render/${file}:fontcolor=0x555555:fontsize=${Math.round(50 * scale) || 36}:line_spacing=14:x=(w-text_w)/2:y=${cardTextY}:enable='${enable}'`,
      );
    }
    if (scene.speakerLabel) {
      const file = `tag_${String(i).padStart(3, "0")}.txt`;
      writeFileSync(join(renderDir, file), scene.speakerLabel, "utf8");
      drawtexts.push(
        `drawtext=fontfile='${FONT}':textfile=render/${file}:fontcolor=0x334155:fontsize=${Math.round(40 * scale) || 30}:box=1:boxcolor=0xFFFFFF@0.7:boxborderw=14:x=(w-text_w)/2:y=${tagY}:enable='${enable}'`,
      );
    }
  }

  // ---- 字幕焼き込み + 音声ミックス ----
  const textStage = drawtexts.length > 0 ? `${drawtexts.join(",")},` : "";
  const videoChain = `[${last}]${textStage}ass=${subtitlesDir}/subtitles.ass,fps=${FPS},format=yuv420p[vout]`;
  const audioChain = `[2:a]volume=0.12[bgm];[1:a][bgm]amix=inputs=2:duration=first:normalize=0[aout]`;
  const filterComplex = [...filterParts, videoChain, audioChain].join(";");
  writeFileSync(join(renderDir, "filter.txt"), filterComplex, "utf8");

  const outName = input.outName ?? "render/sample.mp4";
  run(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex_script", "render/filter.txt",
      "-map", "[vout]", "-map", "[aout]",
      "-t", (timeline.totalDurationSec + 0.4).toFixed(2),
      "-r", String(FPS),
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      outName,
    ],
    workdir,
  );

  const probe = probeStreams(outName, workdir);
  if (!probe.hasVideo || !probe.hasAudio) throw new Error("生成MP4に映像または音声ストリームがありません");
  if (probe.width !== width || probe.height !== height) {
    throw new Error(`解像度が不正です: ${probe.width}x${probe.height}（期待値 ${width}x${height}）`);
  }
  if (Math.abs(probe.durationSec - timeline.totalDurationSec) > 2.5) {
    throw new Error(
      `尺が想定と一致しません: 実測${probe.durationSec.toFixed(1)}秒 / 想定${timeline.totalDurationSec.toFixed(1)}秒`,
    );
  }
  return { videoPath: join(workdir, outName), probe };
}
