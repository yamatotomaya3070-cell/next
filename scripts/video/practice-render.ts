/**
 * 練習素材のレンダリング（Stage4配線）。
 *
 * 練習台本(GeneratedPracticeScript)から「編集前のバラバラ素材」を書き出す:
 *   1. 各セグメントの音声を generateVoices(既存TTS) で生成
 *   2. セグメントごとに素材クリップ clip_NNN.mp4（背景＋立ち絵＋音声、テロップ無し）を作る
 *      ※テロップ付けは就労者の練習作業なので素材には焼き込まない
 *   3. must クリップだけを順に連結して完成見本 sample.mp4（職員/AIレビュー用）を作る
 *   4. 素材クリップ＋依頼書＋作業指示書を assets.zip にまとめる（就労者への支給素材）
 *
 * ffmpeg が必要なため Vercel では動かせない。practice-worker.ts がローカル/Docker で実行する。
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { generateVoices } from "./tts";
import { run, probeDurationSec, probeStreams } from "./exec";
import { practiceRenderInputs } from "../../src/lib/practice-script/renderInputs";
import { buildPracticeCasePackage } from "../../src/lib/practice-script/package";
import { resolveDifficultyTier } from "../../src/lib/practice-script/difficulty";
import type { GeneratedPracticeScript } from "../../src/lib/practice-script/schema";
import type { StyleGuideContent } from "../../src/lib/style-guide/schema";
import type { PracticeAnswerData } from "../../src/lib/practice-script/package";

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

export interface PracticeRenderInput {
  workdir: string;
  script: GeneratedPracticeScript;
  styleGuide: StyleGuideContent;
  difficulty: string; // beginner / intermediate / advanced
  assetsDir?: string; // 背景画像などの共通素材（既定 assets/video）
  /** 話者キー → 立ち絵PNGの絶対パス（無ければ背景＋音声のみ） */
  standingImages?: Record<string, string>;
}

export interface PracticeRenderResult {
  clipFiles: string[]; // clips/ 内の相対ファイル名
  samplePath: string; // 完成見本（must連結）
  zipPath: string; // 支給素材ZIP
  answerData: PracticeAnswerData;
}

/** 1セグメント = 1素材クリップ（背景＋立ち絵＋音声、テロップ無し） */
function renderClip(
  workdir: string,
  bgAbs: string,
  standingAbs: string | undefined,
  wavRel: string,
  durationSec: number,
  outRel: string,
): void {
  const inputs: string[] = ["-loop", "1", "-i", bgAbs];
  let audioIndex = 1;
  let filter = `[0:v]scale=${WIDTH}:${HEIGHT},setsar=1`;
  if (standingAbs) {
    inputs.push("-loop", "1", "-i", standingAbs);
    audioIndex = 2;
    filter = `[0:v]scale=${WIDTH}:${HEIGHT},setsar=1[bg];[1:v]scale=-1:${Math.round(
      HEIGHT * 0.72,
    )}[ch];[bg][ch]overlay=(W-w)/2:H-h[v]`;
  } else {
    filter += "[v]";
  }
  inputs.push("-i", wavRel);

  run(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex", filter,
      "-map", "[v]", "-map", `${audioIndex}:a`,
      "-t", (durationSec + 0.15).toFixed(2),
      "-r", String(FPS),
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      outRel,
    ],
    workdir,
  );
}

export async function renderPracticeMaterials(
  input: PracticeRenderInput,
): Promise<PracticeRenderResult> {
  const workdir = resolve(input.workdir);
  const assetsDir = resolve(input.assetsDir ?? join("assets", "video"));
  const bgAbs = join(assetsDir, "bg_default.png");
  if (!existsSync(bgAbs)) {
    throw new Error(`背景画像がありません: ${bgAbs}（scripts/video/generate-assets.ts を実行してください）`);
  }

  mkdirSync(workdir, { recursive: true });
  const clipsDir = join(workdir, "clips");
  const pkgDir = join(workdir, "package");
  const renderDir = join(workdir, "render");
  mkdirSync(clipsDir, { recursive: true });
  mkdirSync(pkgDir, { recursive: true });
  mkdirSync(renderDir, { recursive: true });

  const profile = resolveDifficultyTier(input.difficulty);
  const inputs = practiceRenderInputs(input.script, input.styleGuide);

  // ---- 1. 音声 ----
  const audios = await generateVoices(inputs.audioScenes, inputs.voiceProfiles, workdir);
  const audioBySceneId = new Map(audios.map((a) => [a.sceneId, a]));

  // ---- 2. 素材クリップ ----
  const clipFiles: string[] = [];
  const mustClipFiles: string[] = [];
  for (const clip of inputs.clips) {
    const audio = audioBySceneId.get(clip.segmentId);
    if (!audio) throw new Error(`音声が見つかりません: ${clip.segmentId}`);
    const durationSec = probeDurationSec(join("voices", audio.file), workdir);
    const standingRaw = input.standingImages?.[clip.speakerKey];
    // ffmpeg は cwd=workdir で走るため、立ち絵は絶対パスに解決してから渡す
    const standingAbs = standingRaw ? resolve(standingRaw) : undefined;
    const outRel = join("clips", clip.filename);
    if (!existsSync(join(workdir, outRel))) {
      renderClip(workdir, bgAbs, standingAbs, join("voices", audio.file), durationSec, outRel);
    }
    clipFiles.push(clip.filename);
    if (clip.isMust) mustClipFiles.push(clip.filename);
  }

  // ---- 3. 完成見本（must連結） ----
  const listPath = join(renderDir, "must_concat.txt");
  writeFileSync(
    listPath,
    mustClipFiles.map((f) => `file '${resolve(clipsDir, f).replace(/\\/g, "/")}'`).join("\n") + "\n",
    "utf8",
  );
  const sampleRel = join("render", "sample.mp4");
  run(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", "render/must_concat.txt", "-c", "copy", sampleRel],
    workdir,
  );
  const sampleProbe = probeStreams(sampleRel, workdir);
  if (!sampleProbe.hasVideo || !sampleProbe.hasAudio) {
    throw new Error("完成見本に映像または音声がありません");
  }

  // ---- 4. 支給素材ZIP（クリップ＋依頼書＋作業指示書） ----
  const pkg = buildPracticeCasePackage(input.script, profile, input.styleGuide);
  for (const f of clipFiles) copyFileSync(join(clipsDir, f), join(pkgDir, f));
  writeFileSync(join(pkgDir, "依頼書.txt"), pkg.requestDoc, "utf8");
  writeFileSync(
    join(pkgDir, "作業指示書.txt"),
    [
      "【作業のやり方】",
      ...pkg.workInstructions.map((s, i) => `${i + 1}. ${s}`),
      "",
      "【納品前チェック】",
      ...pkg.selfCheckItems.map((s) => `・${s}`),
    ].join("\n"),
    "utf8",
  );
  zipDir(workdir);

  return {
    clipFiles,
    samplePath: join(workdir, sampleRel),
    zipPath: join(workdir, "assets.zip"),
    answerData: pkg.answerData,
  };
}

/** package/ を assets.zip にまとめる（Windows=Compress-Archive / それ以外=zip） */
function zipDir(workdir: string): void {
  if (process.platform === "win32") {
    run(
      "powershell",
      ["-NoProfile", "-Command", "Compress-Archive -Path package\\* -DestinationPath assets.zip -Force"],
      workdir,
    );
  } else {
    run("bash", ["-c", "cd package && zip -r ../assets.zip . >/dev/null"], workdir);
  }
}
