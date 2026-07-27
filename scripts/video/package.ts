/**
 * 案件パッケージ生成（工程: packaging_assets）
 * テンプレート非依存: 依頼書・編集指示書・素材一覧・正解データを作り、
 * 支給素材一式（未編集素材）をZIPにまとめる。
 * 「完成見本」と「未編集素材」を必ず両方生成する（見本のみ生成しない）。
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ManualStep } from "../../src/lib/types";
import type { AudioScene, RenderSceneInfo, VoiceProfile } from "../../src/lib/video/templates";
import type { VideoTemplateConfig } from "../../src/lib/video/templates/types";
import type { TemplateAnswerData, TemplateTimeline } from "../../src/lib/video/templates/types";
import { run } from "./exec";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildRequestDoc(title: string, timeline: TemplateTimeline, config: VideoTemplateConfig): string {
  const total = Math.round(timeline.totalDurationSec);
  return `## お仕事の依頼書

お世話になります。${config.label}の編集をお願いします。

### 動画について
- タイトル: ${title}
- ジャンル: ${config.label}（${config.description}）
- 完成の長さ: 約${total}秒（${formatTime(total)}）

### 納品について
- 納期: 割り当てから3日以内
- 画面サイズ: ${config.width}x${config.height}（${config.aspectRatio}）
- 納品形式: MP4（H.264 / AAC）
- ファイル名: 「douga_名前.mp4」

### 編集ルール
${config.traineeTasks.map((t) => `- ${t}`).join("\n")}

### 注意事項
- 支給素材以外の画像や音楽は使わないでください
- わからないことがあれば、遠慮なく質問してください
`;
}

export function buildInstructionDoc(
  scenes: RenderSceneInfo[],
  timeline: TemplateTimeline,
  config: VideoTemplateConfig,
): string {
  const bySceneId = new Map(timeline.scenes.map((s) => [s.sceneId, s]));
  const rows = scenes
    .map((scene) => {
      const t = bySceneId.get(scene.id);
      if (!t) return null;
      const displayText = scene.cardTitle ?? scene.cardText ?? scene.speakerLabel ?? "-";
      return `| ${formatTime(t.startSec)}〜${formatTime(t.endSec)} | ${scene.speakerLabel ?? "-"} | ${t.audioFile} | ${t.narration || "（無音）"} | ${displayText.replace(/\n/g, " / ")} |`;
    })
    .filter((r): r is string => Boolean(r));

  return `## 編集指示書（タイムライン順）

完成見本と同じ動画になるように、上から順番に編集してください。

| 時間 | 話者 | 使う音声 | 内容 | 画面表示 |
|---|---|---|---|---|
${rows.join("\n")}

### 全体の指示
- シーンとシーンの間は約0.4秒あける
- 画面サイズ: ${config.width}x${config.height}
- BGM「bgm/bgm_loop.wav」を最初から最後まで小さな音量で流す
- 最後まで編集したら、完成見本と見比べて確認する

### この案件で行う作業
${config.traineeTasks.map((t) => `- ${t}`).join("\n")}
`;
}

export function buildManualSteps(
  scenes: RenderSceneInfo[],
  timeline: TemplateTimeline,
  config: VideoTemplateConfig,
): ManualStep[] {
  const bySceneId = new Map(timeline.scenes.map((s) => [s.sceneId, s]));
  const steps: ManualStep[] = [
    { text: "依頼書と編集指示書を最後まで読みます。", tip: "わからない言葉は質問してください。" },
    { text: "支給素材をダウンロードして、フォルダに展開します。", tip: "「支給素材」からZIPを保存できます。" },
    { text: `編集ソフトで新しいプロジェクトを作ります。画面サイズは${config.width}x${config.height}です。`, tip: null },
    { text: "背景画像をタイムライン全体に置きます。", tip: null },
  ];
  for (const scene of scenes) {
    const t = bySceneId.get(scene.id);
    if (!t) continue;
    const label = t.narration ? `「${t.narration.slice(0, 20)}${t.narration.length > 20 ? "…" : ""}」` : "（無音区間）";
    steps.push({
      text: `${formatTime(t.startSec)}から、${scene.speakerLabel ?? ""}の音声「${t.audioFile}」を置き、${label}の字幕を入れます。`,
      tip: null,
    });
  }
  steps.push(
    { text: "BGM「bgm/bgm_loop.wav」を小さな音量で全体に流します。", tip: "声がはっきり聞こえる音量にします。" },
    { text: "最初から最後まで再生して、完成見本と見比べます。", tip: null },
    { text: "MP4形式で書き出して、納品します。", tip: "ファイル名は「douga_名前.mp4」です。" },
  );
  return steps;
}

export function buildSelfCheckItems(config: VideoTemplateConfig): string[] {
  return [
    "音声が指示書の順番どおりにならんでいる",
    "字幕が話者ごとに色分けされている",
    "字幕が画面からはみ出していない",
    "BGMが声のじゃまになっていない",
    "完成の長さが依頼書のとおりになっている",
    ...config.gradingCriteria.map((c) => `「${c}」ができている`),
    "指定のファイル名・形式で書き出した",
  ];
}

export function buildAnswerData(
  title: string,
  timeline: TemplateTimeline,
  config: VideoTemplateConfig,
  assetFiles: string[],
): TemplateAnswerData {
  return {
    title,
    templateType: config.type,
    totalDurationSec: timeline.totalDurationSec,
    toleranceSec: config.toleranceSec,
    volumeTargetDb: { min: -26, max: -12 },
    requiredEdits: config.gradingCriteria,
    sceneOrder: timeline.scenes.map((s) => s.sceneId),
    subtitles: timeline.scenes
      .filter((s) => s.narration)
      .map((s) => ({ sceneId: s.sceneId, text: s.narration, startSec: s.startSec, endSec: s.endSec, speakerLabel: s.speakerLabel })),
    assets: assetFiles,
  };
}

export interface PackageResult {
  packageDir: string;
  zipPath: string;
  assetFiles: string[];
  requestDoc: string;
  instructionDoc: string;
  manualSteps: ManualStep[];
  selfCheckItems: string[];
  answerData: TemplateAnswerData;
}

/** 支給素材ZIPに同梱する実写Bロールクリップ（pipelineがbroll.tsの結果から用意する） */
export interface SuppliedBrollClip {
  path: string; // 正規化済みmp4の絶対パス
  credit: string; // クレジット表記文（"名前 / Pexels (url)"）
  usedInBackground: boolean; // 完成見本で使ったか（就労者には明かさない）
}

/**
 * 支給素材一式（ドキュメント+未編集素材+ZIP）を組み立てる。
 * 未編集素材 = シーンごとの個別音声ファイル（就労者が並べて編集する対象）。
 * 完成見本（sample.mp4）はレンダリング工程が別途生成し、比較・採点用として教材に添付する。
 */
export function buildPackage(
  title: string,
  scenes: RenderSceneInfo[],
  timeline: TemplateTimeline,
  audioScenes: AudioScene[],
  voiceProfiles: VoiceProfile[],
  config: VideoTemplateConfig,
  workdir: string,
  assetsDir: string,
  brollClips: SuppliedBrollClip[] = [],
): PackageResult {
  const pkgDir = join(workdir, "package");
  const audioDir = join(pkgDir, "assets", "audio");
  const imagesDir = join(pkgDir, "assets", "images");
  const bgmDir = join(pkgDir, "assets", "bgm");
  const subsDir = join(pkgDir, "assets", "subtitles");
  const scriptDir = join(pkgDir, "assets", "script");
  for (const dir of [audioDir, imagesDir, bgmDir, subsDir, scriptDir]) mkdirSync(dir, { recursive: true });

  const assetFiles: string[] = [];
  const track = (rel: string) => assetFiles.push(rel);

  // リアル素材モード（Bロールあり）のときは、支給音声の一部に音量差を付けて
  // 「音量をそろえる」練習にする。完成見本は workdir/voices の原本を使うため影響しない。
  const realistic = brollClips.length > 0;
  const VOLUME_OFFSETS_DB = [0, -5, 4]; // シーン順に循環（0=そのまま）
  timeline.scenes.forEach((t, i) => {
    const name = t.audioFile.replace(/^audio\//, "");
    const src = join(workdir, "voices", name);
    const dst = join(audioDir, name);
    const offsetDb = realistic ? VOLUME_OFFSETS_DB[i % VOLUME_OFFSETS_DB.length] : 0;
    if (offsetDb !== 0) {
      run("ffmpeg", ["-y", "-i", src, "-af", `volume=${offsetDb}dB`, dst], workdir);
    } else {
      copyFileSync(src, dst);
    }
    track(`assets/audio/${name}`);
  });
  copyFileSync(resolve(assetsDir, "bgm_loop.wav"), join(bgmDir, "bgm_loop.wav"));
  track("assets/bgm/bgm_loop.wav");
  copyFileSync(join(workdir, "subtitles", "subtitles.srt"), join(subsDir, "subtitles.srt"));
  track("assets/subtitles/subtitles.srt");
  copyFileSync(join(workdir, "subtitles", "timeline.json"), join(subsDir, "timeline.json"));
  track("assets/subtitles/timeline.json");
  writeFileSync(join(scriptDir, "voice_profiles.json"), JSON.stringify(voiceProfiles, null, 2), "utf8");
  track("assets/script/voice_profiles.json");

  // リアル素材モード: 実写Bロールを同梱する。採用/未採用が並び順で分からないよう
  // 順不同（クレジット文字列順の決定的シャッフル）にし、ダミー素材も混ぜる。
  if (realistic) {
    const brollDir = join(pkgDir, "assets", "broll");
    mkdirSync(brollDir, { recursive: true });
    const shuffled = [...brollClips].sort((a, b) => a.credit.localeCompare(b.credit));
    shuffled.forEach((c, i) => {
      const dest = `broll_${String(i + 1).padStart(2, "0")}.mp4`;
      copyFileSync(c.path, join(brollDir, dest));
      track(`assets/broll/${dest}`);
    });
    // クレジット（ライセンス表記）。採用/未採用は明かさない。
    const creditsText =
      `## 使用素材クレジット（Bロール映像）\n\n` +
      `以下はPexelsから取得した映像素材です。ライセンスに従い出典を記載します。\n` +
      `納品時はこのクレジットを含めてください。\n\n` +
      `${brollClips.map((c) => `- ${c.credit}`).join("\n")}\n`;
    writeFileSync(join(pkgDir, "クレジット.md"), creditsText, "utf8");
    track("クレジット.md");
  }

  const requestDoc = buildRequestDoc(title, timeline, config);
  let instructionDoc = buildInstructionDoc(scenes, timeline, config);
  if (realistic) {
    instructionDoc +=
      `\n\n### 実写素材（Bロール）について\n` +
      `- \`assets/broll/\` に実写の映像素材が入っています。**内容に合うものを選んで**背景に配置してください。\n` +
      `- 使わない素材（ダミー）も混ざっています。すべてを使う必要はありません。\n` +
      `- 素材の並び順は完成見本の順番とは限りません。自分で構成を考えてください。\n` +
      `- 支給音声は**音量がばらついている**ものがあります。声の大きさをそろえてください。\n` +
      `- 使用したPexelsのクレジット（クレジット.md）を納品物に含めてください。\n`;
  }
  writeFileSync(join(pkgDir, "依頼書.md"), requestDoc, "utf8");
  writeFileSync(join(pkgDir, "編集指示書.md"), instructionDoc, "utf8");
  writeFileSync(join(pkgDir, "素材一覧.md"), `## 素材一覧\n\n${assetFiles.map((f) => `- ${f}`).join("\n")}\n`, "utf8");

  run("powershell", ["-NoProfile", "-Command", "Compress-Archive -Path package\\* -DestinationPath assets.zip -Force"], workdir);

  return {
    packageDir: pkgDir,
    zipPath: join(workdir, "assets.zip"),
    assetFiles,
    requestDoc,
    instructionDoc,
    manualSteps: buildManualSteps(scenes, timeline, config),
    selfCheckItems: buildSelfCheckItems(config),
    answerData: buildAnswerData(title, timeline, config, assetFiles),
  };
}
