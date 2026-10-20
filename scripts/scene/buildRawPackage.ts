// 自動で並べる形の素材パッケージ（build_materials.mjs の出力）から、カット練習の形のパッケージを作る。
//   ・声：1文ずつの音声をやめ、場面ごとに1本の「録ったままの声」にする（沈黙・えー・言い直し入り。src/lib/scene/rawTakes.ts）
//   ・台本：正しい文だけ（テロップを作るのに使う）
//   ・BGM は2曲から、効果音は6種類から受講者がえらぶ。並べるスクリプトは使わない
//   ・消す所の答えは 編集ポイント.json（受講者には配らない。検品で使う）
//   使い方: npx tsx scripts/scene/buildRawPackage.ts <元のパッケージ> <出力フォルダ> [種]
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";
import {
  CUT_KIND_JA,
  NG_CLIPS,
  asNgSpeaker,
  cutRegions,
  ngVoiceRegions,
  ngClipFile,
  planRawTakes,
  seededRandom,
  type NgSpeaker,
  type PlacedSegment,
  type RawScenePlan,
} from "@/lib/scene/rawTakes";
import { dbToGain, downsampleHalf, fadeOut, firstPauseAfter, readWav, speakingPointAfter, speechRms, trimSilence, upsample, writeWav, type Pcm } from "./wav";
import { buildRawAppTask } from "./rawAppTask";

const RATE = 48000;
const NG_DIR = "assets/voice_ng";
const SE_DIR = "assets/se";
const BGM_CHOICES = [
  { src: "assets/video/bgm_classroom_body.wav", name: "BGM_A_落ち着いた.wav" },
  { src: "assets/video/bgm_opening.wav", name: "BGM_B_明るい.wav" },
];
/** 言いよどみの声は、その人のセリフより少し小さめにそろえる */
const NG_LEVEL = { filler: 0.8, cue: 0.75 } as const;
/** 部屋の小さな雑音（完全な無音だと、録ったままの声らしくない） */
const ROOM_NOISE = 0.0012;
/** 言いまちがえで止める区切りは、これより長いものにする（「はい、」で止まると言いまちがえに聞こえない） */
const FLUB_MIN_PHRASE_SEC = 0.8;
/** 録った声のいちばん大きい所（書き出しで音がわれないように） */
const MAX_PEAK_DB = -3;

interface LegacyLine { speakerJa: string; speaker: string; text: string; audio: string; pad?: { leadF: number; lenF: number } }
interface LegacyScene { no: number; typeJa: string; section: string; figure: string; durationSec: number; overlayTelop?: string; telops?: string[]; lines: LegacyLine[] }
interface LegacyManifest { title: string; theme?: string; goal?: string; spec: { width: number; height: number; fps: number; format: string }; scenes: LegacyScene[]; assets: Record<string, unknown>; sampleDurationSec?: number; totalSec: number }

export interface RawManifest {
  kind: "raw";
  title: string;
  theme: string;
  spec: LegacyManifest["spec"];
  totalCleanSec: number;
  sampleDurationSec?: number;
  scenes: {
    no: number;
    typeJa: string;
    video: string;
    still: string | null;
    audio: string;
    lines: { speakerJa: string; text: string }[];
  }[];
  assets: { bgm: string[]; se: string[]; opening?: string; ending?: string };
}

export interface EditKey {
  seed: string;
  scenes: {
    no: number;
    audio: string;
    durationSec: number;
    gainDb: number;
    cuts: { kind: string; kindJa: string; startSec: number; endSec: number }[];
    kept: { li: number; text: string; speakerJa: string; startSec: number; endSec: number }[];
    /** わざと入れた声の位置（検品で、提出に残っていないかを探す） */
    ngVoices: { kind: string; clip: string; speaker: string; startSec: number; endSec: number }[];
  }[];
}

const SAMPLES_PER_F = RATE / 24;

/**
 * 元のパッケージの音声から、無音を足す前の声だけを取り出す。
 * 足した無音の記録（pad）が無い古いパッケージは、前後の無音を落として使う。
 */
function cleanVoice(pkgDir: string, ln: LegacyLine): Float32Array {
  const pcm = upsample(readWav(`${pkgDir}/${ln.audio}`), RATE);
  if (!ln.pad) return trimSilence(pcm.samples, RATE);
  const from = ln.pad.leadF * SAMPLES_PER_F;
  return pcm.samples.slice(from, from + ln.pad.lenF * SAMPLES_PER_F);
}

function loadNgClips(): Map<string, Float32Array> {
  const map = new Map<string, Float32Array>();
  for (const sp of ["narrator", "haru", "mina"] as NgSpeaker[]) {
    for (const c of NG_CLIPS) {
      const file = `${NG_DIR}/${ngClipFile(sp, c.id)}`;
      if (!existsSync(file)) throw new Error(`言いよどみの声がありません: ${file}（npx tsx scripts/scene/genNgVoices.ts で作ります）`);
      const pcm = upsample(readWav(file), RATE);
      map.set(`${sp}/${c.id}`, trimSilence(pcm.samples, RATE));
    }
  }
  return map;
}

function scaled(samples: Float32Array, gain: number): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}

/** 1場面分の「録ったままの声」を組み立てる */
function assembleScene(
  plan: RawScenePlan,
  voices: Float32Array[],
  ng: Map<string, Float32Array>,
  levels: Map<NgSpeaker, number>,
): { samples: Float32Array; placed: PlacedSegment[] } {
  const parts: Float32Array[] = [];
  const placed: PlacedSegment[] = [];
  let pos = 0;
  const push = (seg: PlacedSegment["segment"], s: Float32Array) => {
    placed.push({ segment: seg, startSec: pos / RATE, endSec: (pos + s.length) / RATE });
    parts.push(s);
    pos += s.length;
  };
  for (const seg of plan.segments) {
    if (seg.kind === "silence") push(seg, new Float32Array(Math.round(seg.sec * RATE)));
    else if (seg.kind === "line") push(seg, voices[seg.li]);
    else if (seg.kind === "flub") {
      // 言いまちがえは、最初のひと区切り（0.8秒より後の、最初の切れ目まで）の途中で止める。
      // セリフ全体の割合で決めると、文の切れ目で止まって「言い終わってから言い直す」不自然な声になる
      const v = voices[seg.li];
      const phrase = firstPauseAfter(v, RATE, Math.round(RATE * FLUB_MIN_PHRASE_SEC));
      const aim = Math.round(phrase * seg.ratio);
      const cut = speakingPointAfter(v, RATE, aim, phrase);
      push(seg, fadeOut(v.slice(0, cut), RATE, 0.04));
    } else {
      const clip = ng.get(`${seg.speaker}/${seg.clip}`)!;
      const target = (levels.get(seg.speaker) ?? 0.1) * (seg.cut === "filler" ? NG_LEVEL.filler : NG_LEVEL.cue);
      const rms = speechRms(clip) || target;
      push(seg, scaled(clip, target / rms));
    }
  }
  const out = new Float32Array(pos);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return { samples: out, placed };
}

function lastFrame(video: string, png: string): boolean {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-sseof", "-0.2", "-i", video, "-frames:v", "1", "-update", "1", png], { encoding: "utf8" });
  return r.status === 0 && existsSync(png);
}

function scriptText(m: LegacyManifest): string {
  const out = [`【台本】${m.title}`, "", "話す人と、話す言葉（正しい文）です。テロップの文は、ここから作ります。", ""];
  for (const s of m.scenes) {
    out.push(`■ 場面${s.no}（${s.typeJa}）　音声：素材/音声/S${String(s.no).padStart(2, "0")}_収録.wav`);
    for (const l of s.lines) out.push(`${l.speakerJa}：${l.text}`);
    out.push("");
  }
  return out.join("\r\n");
}

function readmeText(m: LegacyManifest): string {
  return [
    `【${m.title}】 動画編集の素材`,
    "",
    "録ったままの声と、場面ごとの映像があります。不要な所を切って、テロップと音を付け、1本の動画に仕上げてください。",
    "作り方は、アプリの「依頼内容」と「作業のしかた」、教科書（レッスン 3-1 に作業の順番）にあります。",
    "",
    "■ フォルダの中身",
    "・台本.txt          … 話す人と、正しい文。テロップはここから作ります",
    "・素材/音声         … 場面ごとの、録ったままの声（言いよどみ・言い直し・長い沈黙が入っています）",
    "・素材/映像         … 場面ごとの映像（文字なし）と、オープニング・エンディング",
    "・素材/静止画       … 各場面の映像の最後の1枚。声より映像が短いときに、のばす用",
    "・素材/立ち絵       … ハル・ミナ先生の表情ちがいの画像（使うかは自由）",
    "・素材/BGM          … BGM の候補（2曲）。1曲をえらんで使います",
    "・素材/効果音       … 効果音（6種類）。名前は使いどころの目安です",
    "",
    "※ 数字や制度（税率・非課税枠など）は台本のとおりに。内容は変えないでください。",
    "※ BGM と効果音は、この案件のために作ったもので、自由に使えます。",
  ].join("\r\n");
}

export function buildRawPackage(srcDir: string, outDir: string, seed: string): { manifest: RawManifest; key: EditKey } {
  const m = JSON.parse(readFileSync(`${srcDir}/素材一覧.json`, "utf8")) as LegacyManifest;
  rmSync(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 });
  for (const d of ["素材/音声", "素材/映像", "素材/静止画", "素材/BGM", "素材/効果音"]) mkdirSync(`${outDir}/${d}`, { recursive: true });

  const voices = m.scenes.map((s) => s.lines.map((ln) => cleanVoice(srcDir, ln)));
  const plans = planRawTakes(
    m.scenes.map((s, si) => s.lines.map((ln, li) => ({ speaker: ln.speaker, durSec: voices[si][li].length / RATE }))),
    seed,
  );
  // 話す人ごとの声の大きさ（言いよどみの声をそろえる基準）
  const levels = new Map<NgSpeaker, number>();
  for (const sp of ["narrator", "haru", "mina"] as NgSpeaker[]) {
    const all = m.scenes.flatMap((s, si) => s.lines.flatMap((ln, li) => (asNgSpeaker(ln.speaker) === sp ? [speechRms(voices[si][li])] : [])));
    if (all.length) levels.set(sp, all.reduce((a, b) => a + b, 0) / all.length);
  }
  const ng = loadNgClips();
  const rnd = seededRandom(`${seed}/noise`);

  const manifest: RawManifest = {
    kind: "raw", title: m.title, theme: m.theme ?? "", spec: m.spec, totalCleanSec: m.totalSec,
    sampleDurationSec: m.sampleDurationSec, scenes: [], assets: { bgm: [], se: [] },
  };
  const key: EditKey = { seed, scenes: [] };

  // 全場面を組み立ててから、いちばん大きい所が MAX_PEAK_DB になるよう全体を同じだけ下げる（場面どうしの大きさの差は残す）。
  // そのあと、小さく録れた場面を下げ、部屋の小さな雑音を足す
  const assembled = m.scenes.map((_, si) => assembleScene(plans[si], voices[si], ng, levels));
  let peak = 0;
  for (const a of assembled) for (const v of a.samples) peak = Math.max(peak, Math.abs(v));
  const fit = peak > 0 ? Math.min(1, dbToGain(MAX_PEAK_DB) / peak) : 1;
  assembled.forEach((a, si) => {
    const g = fit * dbToGain(plans[si].gainDb);
    for (let i = 0; i < a.samples.length; i++) a.samples[i] = a.samples[i] * g + (rnd() * 2 - 1) * ROOM_NOISE;
  });

  m.scenes.forEach((s, si) => {
    const tag = String(s.no).padStart(2, "0");
    const audio = `素材/音声/S${tag}_収録.wav`;
    const { samples, placed } = assembled[si];
    // 配るファイルは 24kHz（もとの声も 24kHz で作っているので音は変わらず、大きさが半分になる。支給素材は1ファイル50MBまで）
    writeWav(`${outDir}/${audio}`, downsampleHalf({ rate: RATE, samples } satisfies Pcm));
    const { cuts, kept } = cutRegions(placed);
    key.scenes.push({
      no: s.no, audio, durationSec: +(samples.length / RATE).toFixed(3), gainDb: plans[si].gainDb,
      cuts: cuts.map((c) => ({ ...c, kindJa: CUT_KIND_JA[c.kind] })),
      kept: kept.map((k) => ({ ...k, text: s.lines[k.li].text, speakerJa: s.lines[k.li].speakerJa })),
      ngVoices: ngVoiceRegions(placed),
    });

    let video = s.figure;
    if (existsSync(`${srcDir}/${s.figure}`)) {
      video = s.figure.replace(/^素材\/(図解|背景)\//, "素材/映像/");
      copyFileSync(`${srcDir}/${s.figure}`, `${outDir}/${video}`);
    }
    const still = video.endsWith(".mp4") ? `素材/静止画/S${tag}_最後の画面.png` : null;
    const hasStill = still ? lastFrame(`${outDir}/${video}`, `${outDir}/${still}`) : false;
    manifest.scenes.push({ no: s.no, typeJa: s.typeJa, video, still: hasStill ? still : null, audio, lines: s.lines.map((l) => ({ speakerJa: l.speakerJa, text: l.text })) });
  });

  for (const [k, name] of [["opening", "オープニング.mp4"], ["ending", "エンディング.mp4"]] as const) {
    if (!existsSync(`${srcDir}/素材/映像/${name}`)) continue;
    copyFileSync(`${srcDir}/素材/映像/${name}`, `${outDir}/素材/映像/${name}`);
    manifest.assets[k] = `素材/映像/${name}`;
  }
  if (existsSync(`${srcDir}/素材/立ち絵`)) cpSync(`${srcDir}/素材/立ち絵`, `${outDir}/素材/立ち絵`, { recursive: true });
  for (const b of BGM_CHOICES) {
    if (!existsSync(b.src)) continue;
    copyFileSync(b.src, `${outDir}/素材/BGM/${b.name}`);
    manifest.assets.bgm.push(`素材/BGM/${b.name}`);
  }
  for (const f of existsSync(SE_DIR) ? readdirSync(SE_DIR).filter((x) => x.endsWith(".wav")) : []) {
    copyFileSync(`${SE_DIR}/${f}`, `${outDir}/素材/効果音/${f}`);
    manifest.assets.se.push(`素材/効果音/${f}`);
  }
  if (manifest.assets.se.length === 0) throw new Error("効果音がありません（npx tsx scripts/scene/genSoundEffects.ts で作ります）");
  if (existsSync(`${srcDir}/完成見本.mp4`)) copyFileSync(`${srcDir}/完成見本.mp4`, `${outDir}/完成見本.mp4`);

  writeFileSync(`${outDir}/台本.txt`, "﻿" + scriptText(m), "utf8");
  writeFileSync(`${outDir}/はじめに.txt`, "﻿" + readmeText(m), "utf8");
  writeFileSync(`${outDir}/素材一覧.json`, JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(`${outDir}/編集ポイント.json`, JSON.stringify(key, null, 2), "utf8");
  writeFileSync(`${outDir}/app_task.json`, JSON.stringify(buildRawAppTask(manifest, key), null, 2), "utf8");
  return { manifest, key };
}

function summary(key: EditKey): string {
  const count = (k: string) => key.scenes.reduce((n, s) => n + s.cuts.filter((c) => c.kind === k).length, 0);
  const rawSec = key.scenes.reduce((n, s) => n + s.durationSec, 0);
  return `収録 ${key.scenes.length}本・計${rawSec.toFixed(1)}秒 / 言いよどみ ${count("filler")}・言い直し ${count("retake")}・長い沈黙 ${count("long_gap")}`;
}

if (process.argv[1] && basename(process.argv[1]).startsWith("buildRawPackage")) {
  const [src, out, seed] = process.argv.slice(2);
  if (!src || !out) {
    console.error("使い方: npx tsx scripts/scene/buildRawPackage.ts <元のパッケージ> <出力フォルダ> [種]");
    process.exit(1);
  }
  const { key } = buildRawPackage(src, out, seed || basename(src));
  console.log(`カット練習の素材を作りました: ${out}\n  ${summary(key)}`);
}

export { summary as rawPackageSummary };
