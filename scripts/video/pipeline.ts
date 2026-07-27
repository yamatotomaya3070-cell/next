/**
 * 動画案件生成パイプラインの統括（テンプレート非依存）。
 * 各工程は独立して再実行可能（成果物が既にあれば再利用）で、失敗時は途中から再開できる。
 * テンプレート固有の違いは src/lib/video/templates 配下から取得した設定・関数だけに現れ、
 * このファイル自体はどのテンプレートかを個別に分岐しない（新テンプレート追加時も変更不要）。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getTemplateConfig,
  getVoiceProfiles,
  keepOnlyScenes,
  toAudioScenes,
  toRenderScenes,
  validateTemplateScript,
  type AnyVideoScript,
  type VideoTemplateType,
} from "../../src/lib/video/templates";
import { generateScript } from "./script-gen";
import { generateVoices } from "./tts";
import { generateSubtitles } from "./subtitles";
import { renderVideo } from "./render";
import { buildPackage, type PackageResult, type SuppliedBrollClip } from "./package";
import { buildBrollBackground } from "./broll";
import { probeStreams } from "./exec";
import { isStockConfigured, creditLine, type StockClip } from "../../src/lib/video/stock";

export const PIPELINE_STAGES = [
  "generating_script",
  "generating_voice",
  "generating_assets",
  "generating_subtitles",
  "rendering_preview",
  "packaging_assets",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_PROGRESS: Record<PipelineStage, number> = {
  generating_script: 10,
  generating_voice: 30,
  generating_assets: 40,
  generating_subtitles: 55,
  rendering_preview: 85,
  packaging_assets: 95,
};

export interface PipelineInput {
  templateType: VideoTemplateType;
  theme: string;
  targetDurationSec: number;
  workdir: string;
  assetsDir?: string;
  provider?: "auto" | "mock";
  providedScript?: AnyVideoScript;
  /** 背景を実写Bロール動画にする（PEXELS_API_KEY未設定なら自動で無効化し静止画にフォールバック） */
  useBroll?: boolean;
  /** Bロール検索キーワード（未指定なら theme を使用）。英語のほうが実写がヒットしやすい */
  brollKeywords?: string[];
  onStage?: (stage: PipelineStage, progress: number) => Promise<void> | void;
}

export interface PipelineOutput {
  script: AnyVideoScript;
  provider: string;
  timeline: import("../../src/lib/video/templates/types").TemplateTimeline;
  videoPath: string;
  rawTakeVideoPath: string | null; // interview_edit のみ: カット前の連続収録相当の動画
  brollCredits: StockClip[]; // 実写Bロール使用時のクレジット（未使用時は空配列）
  pkg: PackageResult;
}

function backgroundFileFor(templateType: VideoTemplateType): string {
  return templateType === "vertical_short" ? "bg_vertical.png" : "bg_default.png";
}

function requiredAssetFilesFor(templateType: VideoTemplateType): string[] {
  const bg = backgroundFileFor(templateType);
  const usesCharacters = templateType === "character_explainer" || templateType === "vertical_short";
  return [
    bg,
    "bgm_loop.wav",
    ...(usesCharacters
      ? ["ao_normal.png", "ao_happy.png", "ao_surprised.png", "midori_normal.png", "midori_happy.png", "midori_surprised.png"]
      : []),
  ];
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { templateType } = input;
  const config = getTemplateConfig(templateType);
  const workdir = resolve(input.workdir);
  mkdirSync(workdir, { recursive: true });
  const assetsDir = resolve(input.assetsDir ?? join("assets", "video"));
  const notify = async (stage: PipelineStage) => {
    await input.onStage?.(stage, STAGE_PROGRESS[stage]);
  };

  // ---- 1. 台本 ----
  await notify("generating_script");
  const scriptPath = join(workdir, "script.json");
  let script: AnyVideoScript;
  let provider = "cached";
  if (input.providedScript) {
    const revalidated = validateTemplateScript(templateType, input.providedScript);
    if (!revalidated.ok || !revalidated.script) {
      throw new Error(`編集後の台本が検証に失敗しました: ${revalidated.errors.join(", ")}`);
    }
    script = revalidated.script;
    provider = "manual-edit";
    const cached = existsSync(scriptPath) ? JSON.stringify(JSON.parse(readFileSync(scriptPath, "utf8"))) : null;
    if (cached !== JSON.stringify(script)) {
      // 台本が変わった以上、下流の成果物はすべて古いままでは整合しないため作り直す
      for (const dir of ["voices", "subtitles", "subtitles_raw", "render", "package"]) {
        rmSync(join(workdir, dir), { recursive: true, force: true });
      }
    }
    writeFileSync(scriptPath, JSON.stringify(script, null, 2), "utf8");
  } else if (existsSync(scriptPath)) {
    const revalidated = validateTemplateScript(templateType, JSON.parse(readFileSync(scriptPath, "utf8")));
    if (!revalidated.ok || !revalidated.script) {
      throw new Error(`保存済み台本が壊れています: ${revalidated.errors.join(", ")}`);
    }
    script = revalidated.script;
  } else {
    const generated = await generateScript(templateType, input.theme, input.targetDurationSec, input.provider ?? "auto");
    script = generated.script;
    provider = generated.provider;
    writeFileSync(scriptPath, JSON.stringify(script, null, 2), "utf8");
  }

  const voiceProfiles = getVoiceProfiles(templateType);

  // ---- 2. 音声（台本の全セグメント分。interview_editはcutセグメントも含む） ----
  await notify("generating_voice");
  const fullAudioScenes = toAudioScenes(script);
  const fullAudios = await generateVoices(fullAudioScenes, voiceProfiles, workdir);

  // ---- 3. 共通素材の確認 ----
  await notify("generating_assets");
  const missing = requiredAssetFilesFor(templateType).filter((f) => !existsSync(join(assetsDir, f)));
  if (missing.length > 0) {
    throw new Error(`共通素材が不足しています: ${missing.join(", ")}（scripts/video/generate-assets.ts を実行してください）`);
  }

  // ---- 4. 字幕（完成見本＝keepのみ。interview_editは実質フィルタなしで同じ） ----
  await notify("generating_subtitles");
  const sampleScript = keepOnlyScenes(script);
  const sampleAudioScenes = toAudioScenes(sampleScript);
  const sampleAudios = fullAudios.filter((a) => sampleAudioScenes.some((s) => s.id === a.sceneId));
  const subs = generateSubtitles(sampleAudioScenes, voiceProfiles, sampleAudios, config.subtitleStyle, config.width, config.height, workdir, "subtitles");

  // interview_edit のみ: カット前の連続収録相当（未編集フル）の字幕・音声も生成する
  const isInterview = templateType === "interview_edit";
  const rawSubs = isInterview
    ? generateSubtitles(fullAudioScenes, voiceProfiles, fullAudios, config.subtitleStyle, config.width, config.height, workdir, "subtitles_raw")
    : null;

  // ---- 5. レンダリング（完成見本 + 必要ならraw_take） ----
  await notify("rendering_preview");
  const sampleRenderScenes = toRenderScenes(sampleScript);

  // 背景: 既定は静止画。useBroll かつ PEXELS_API_KEY 設定時のみ実写Bロール動画に差し替える。
  // 完成見本とraw_takeで同じ背景を共有し、尺は長い方(raw)に合わせる。
  let backgroundFile = backgroundFileFor(templateType);
  let backgroundIsVideo = false;
  let brollCredits: StockClip[] = [];
  let suppliedBrollClips: SuppliedBrollClip[] = [];
  if (input.useBroll && isStockConfigured()) {
    const orientation = config.width >= config.height ? "landscape" : "portrait";
    const keywords =
      input.brollKeywords && input.brollKeywords.length > 0 ? input.brollKeywords : [input.theme];
    const brollPath = join(workdir, "render", "broll_background.mp4");
    const manifestPath = join(workdir, "render", "broll_manifest.json");
    const brollTargetSec =
      isInterview && rawSubs ? rawSubs.timeline.totalDurationSec : subs.timeline.totalDurationSec;
    if (!existsSync(brollPath)) {
      mkdirSync(join(workdir, "render"), { recursive: true });
      const built = await buildBrollBackground({
        keywords,
        totalDurationSec: brollTargetSec,
        width: config.width,
        height: config.height,
        orientation,
        outPath: brollPath,
        tmpDir: join(workdir, "broll_tmp"),
      });
      brollCredits = built.credits;
      suppliedBrollClips = built.segments.map((s) => ({
        path: s.path,
        credit: creditLine(s.clip),
        usedInBackground: s.usedInBackground,
      }));
      // 再実行（背景キャッシュ利用）時にパッケージへ再供給できるようマニフェストを保存
      writeFileSync(manifestPath, JSON.stringify(suppliedBrollClips, null, 2), "utf8");
      writeFileSync(
        join(workdir, "broll_credits.txt"),
        built.credits.map((c) => creditLine(c)).join("\n") + "\n",
        "utf8",
      );
    } else if (existsSync(manifestPath)) {
      suppliedBrollClips = JSON.parse(readFileSync(manifestPath, "utf8")) as SuppliedBrollClip[];
    }
    backgroundFile = brollPath;
    backgroundIsVideo = true;
  }

  const samplePath = join(workdir, "render", "sample.mp4");
  let videoPath = samplePath;
  let needRender = true;
  if (existsSync(samplePath)) {
    try {
      const probe = probeStreams("render/sample.mp4", workdir);
      needRender = !(probe.hasVideo && probe.hasAudio);
    } catch {
      needRender = true;
    }
  }
  if (needRender) {
    videoPath = renderVideo({
      scenes: sampleRenderScenes,
      timeline: subs.timeline,
      workdir,
      assetsDir,
      width: config.width,
      height: config.height,
      backgroundFile,
      backgroundIsVideo,
      outName: "render/sample.mp4",
      subtitlesDir: "subtitles",
    }).videoPath;
  }

  let rawTakeVideoPath: string | null = null;
  if (isInterview && rawSubs) {
    const rawPath = join(workdir, "render", "raw_take.mp4");
    let needRawRender = true;
    if (existsSync(rawPath)) {
      try {
        const probe = probeStreams("render/raw_take.mp4", workdir);
        needRawRender = !(probe.hasVideo && probe.hasAudio);
      } catch {
        needRawRender = true;
      }
    }
    if (needRawRender) {
      rawTakeVideoPath = renderVideo({
        scenes: toRenderScenes(script),
        timeline: rawSubs.timeline,
        workdir,
        assetsDir,
        width: config.width,
        height: config.height,
        backgroundFile,
        backgroundIsVideo,
        outName: "render/raw_take.mp4",
        subtitlesDir: "subtitles_raw",
      }).videoPath;
    } else {
      rawTakeVideoPath = rawPath;
    }
  }

  // ---- 6. パッケージ（未編集素材一式。sample.mp4は別途教材として添付） ----
  await notify("packaging_assets");
  const pkg = buildPackage(
    script.title,
    isInterview ? toRenderScenes(script) : sampleRenderScenes,
    isInterview && rawSubs ? rawSubs.timeline : subs.timeline,
    isInterview ? fullAudioScenes : sampleAudioScenes,
    voiceProfiles,
    config,
    workdir,
    assetsDir,
    suppliedBrollClips,
  );

  return { script, provider, timeline: subs.timeline, videoPath, rawTakeVideoPath, brollCredits, pkg };
}
