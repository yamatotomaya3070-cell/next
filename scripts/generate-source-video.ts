/**
 * 素材動画生成プロトタイプ（フェーズ1.5）
 *
 * 台本生成(AI/mock) → 音声合成(Windows SAPI) → 動画合成(ffmpeg) →
 * 正解データ(answer.json: カット区間のタイムスタンプ)を出力する。
 *
 * 使い方:
 *   npx tsx scripts/generate-source-video.ts [出力ディレクトリ]
 *
 * 前提: Windows + ffmpeg (PATH上) + 日本語TTS音声（Microsoft Haruka Desktop）
 * 本番構成では TTS を VOICEVOX / クラウドTTS に、実行環境をサーバーに差し替える。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { generateSourceScript } from "../src/lib/ai";
import type { SourceScriptSegment } from "../src/lib/ai/types";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const BG_COLOR = "0x1e293b";
const LINE_WIDTH = 18; // drawtextは折り返しをしないため手動で改行する

const FONT_CANDIDATES = [
  "C:/Windows/Fonts/meiryo.ttc",
  "C:/Windows/Fonts/YuGothM.ttc",
  "C:/Windows/Fonts/msgothic.ttc",
];

interface AnswerSegment {
  index: number;
  kind: "keep" | "cut";
  cutReason: string | null;
  text: string;
  start: number; // 秒（素材動画のタイムライン上）
  end: number;
}

function run(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
}

function probeDuration(file: string, cwd: string): number {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { cwd, encoding: "utf8" },
  );
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe が ${file} の長さを取得できませんでした: ${out}`);
  }
  return seconds;
}

function wrapText(text: string): string {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += LINE_WIDTH) {
    lines.push(text.slice(i, i + LINE_WIDTH));
  }
  return lines.join("\n");
}

function pickFont(): string {
  const font = FONT_CANDIDATES.find((f) => existsSync(f));
  if (!font) throw new Error("日本語フォントが見つかりません");
  return font.replace(":", "\\:"); // ffmpegフィルタ内のコロンをエスケープ
}

/** 発話セグメントの音声を一括でWAV化（PowerShell + SAPI） */
function synthesizeSpeech(
  segments: SourceScriptSegment[],
  workdir: string,
): void {
  const manifest = segments
    .map((seg, i) => ({ i, text: seg.text }))
    .filter((s) => s.text.length > 0)
    .map((s) => ({ wav: `seg_${s.i}.wav`, text: s.text }));
  writeFileSync(join(workdir, "manifest.json"), JSON.stringify(manifest), "utf8");

  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 manifest.json | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $synth.SelectVoice('Microsoft Haruka Desktop') } catch { }
$synth.Rate = 0
foreach ($item in $items) {
  $synth.SetOutputToWaveFile($item.wav)
  $synth.Speak($item.text)
}
$synth.SetOutputToNull()
$synth.Dispose()
`;
  writeFileSync(join(workdir, "tts.ps1"), "﻿" + ps, "utf8");
  run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "tts.ps1"], workdir);
}

/** 1セグメント分のスライド動画（背景+本文テキスト+音声）を作る */
function renderSegment(
  seg: SourceScriptSegment,
  index: number,
  font: string,
  workdir: string,
): string {
  const out = `seg_${index}.mp4`;
  const encodeArgs = [
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "44100", "-ac", "2",
  ];

  if (seg.text.length === 0) {
    // 沈黙セグメント: 背景のみ（カット箇所だと視覚的に分からないよう文字は出さない）
    const seconds = seg.silenceSeconds ?? 3;
    run("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", `color=c=${BG_COLOR}:s=${WIDTH}x${HEIGHT}:r=${FPS}`,
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-t", String(seconds),
      ...encodeArgs,
      out,
    ], workdir);
    return out;
  }

  const textFile = `seg_${index}.txt`;
  writeFileSync(join(workdir, textFile), wrapText(seg.text), "utf8");
  const drawtext =
    `drawtext=fontfile='${font}':textfile=${textFile}` +
    ":fontcolor=white:fontsize=44:line_spacing=14" +
    ":x=(w-text_w)/2:y=(h-text_h)/2";
  run("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", `color=c=${BG_COLOR}:s=${WIDTH}x${HEIGHT}:r=${FPS}`,
    "-i", `seg_${index}.wav`,
    "-vf", drawtext,
    "-shortest",
    ...encodeArgs,
    out,
  ], workdir);
  return out;
}

async function main() {
  const workdir = resolve(process.argv[2] ?? join("scripts", "output", "source-video"));
  mkdirSync(workdir, { recursive: true });

  console.log("1/4 台本を生成中...");
  const script = await generateSourceScript({
    theme: "パン屋さんの店舗紹介",
    targetKeepSeconds: 30,
    difficulty: 1,
  });
  console.log(`  provider=${script.provider} / セグメント数=${script.segments.length}`);
  writeFileSync(join(workdir, "script.json"), JSON.stringify(script, null, 2), "utf8");

  console.log("2/4 音声合成中 (SAPI)...");
  synthesizeSpeech(script.segments, workdir);

  console.log("3/4 動画合成中 (ffmpeg)...");
  const font = pickFont();
  const parts: string[] = [];
  const answers: AnswerSegment[] = [];
  let cursor = 0;
  for (const [i, seg] of script.segments.entries()) {
    const part = renderSegment(seg, i, font, workdir);
    const seconds = probeDuration(part, workdir);
    answers.push({
      index: i,
      kind: seg.kind,
      cutReason: seg.cutReason,
      text: seg.text,
      start: Math.round(cursor * 100) / 100,
      end: Math.round((cursor + seconds) * 100) / 100,
    });
    cursor += seconds;
    parts.push(part);
  }

  writeFileSync(
    join(workdir, "list.txt"),
    parts.map((p) => `file '${p}'`).join("\n"),
    "utf8",
  );
  run("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", "list.txt",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "source.mp4",
  ], workdir);

  console.log("4/4 正解データを出力中...");
  const keepSeconds = answers
    .filter((a) => a.kind === "keep")
    .reduce((sum, a) => sum + (a.end - a.start), 0);
  const answer = {
    title: script.title,
    scenario: script.scenario,
    totalSeconds: Math.round(cursor * 100) / 100,
    keepSeconds: Math.round(keepSeconds * 100) / 100,
    keepDurationHint: script.keepDurationHint,
    segments: answers,
  };
  writeFileSync(join(workdir, "answer.json"), JSON.stringify(answer, null, 2), "utf8");

  console.log("---");
  console.log(`素材動画: ${join(workdir, "source.mp4")}`);
  console.log(`正解データ: ${join(workdir, "answer.json")}`);
  console.log(`全体 ${answer.totalSeconds}秒 / カット後 ${answer.keepSeconds}秒`);
  console.log(`カット箇所: ${answers.filter((a) => a.kind === "cut").length}箇所`);
}

main().catch((err) => {
  console.error("素材動画の生成に失敗しました:", err);
  process.exit(1);
});
