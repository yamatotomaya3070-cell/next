/**
 * 即時チェックの答えの数字を、配った練習素材から作る。出力は src/lib/guide/practiceCheck/keys.generated.ts。
 * 数字はブラウザの即時チェックと同じ計算（analyze.ts）で出すので、素材を作り直したら必ずこれも流す。
 *
 * 使い方（リポジトリの直下で、buildPracticeKits.ts のあとに）:
 *   npx tsx scripts/practice/buildPracticeKeys.ts [カット練習パッケージのフォルダ]
 *   既定: ../テスト用_カット練習パッケージ_新NISA（2-2 の答え 編集ポイント.json を読む）
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeSamples, speechLevel, speechSpans, totalSec } from "../../src/lib/guide/practiceCheck/analyze";
import { VOICE_LEVEL_QUIET, type PracticeKeys } from "../../src/lib/guide/practiceCheck/keys";

const WORK = ".tmp_read/practice";
const RAW = process.argv[2] ?? "../テスト用_カット練習パッケージ_新NISA";
const OUT = "src/lib/guide/practiceCheck/keys.generated.ts";
const RATE = 48000;
/** 書き出しの目安：映像 600kb/s ＋ 音 128kb/s の2倍まで */
const EXPORT_MB_PER_SEC = ((600 + 128) / 8 / 1024) * 2;

/** 動画や WAV の音を、48kHz モノラルで読む（ブラウザの読み込みと同じ形） */
function decode(file: string): Float32Array {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg で読めません: ${file}\n${r.stderr}`);
  // Buffer の位置が4の倍数とは限らないので、写してから読む
  const buf = Buffer.from(r.stdout as Buffer);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function durationOf(file: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const sec = Number(r.stdout.trim());
  if (r.status !== 0 || !Number.isFinite(sec)) throw new Error(`長さを読めません: ${file}`);
  return sec;
}

const speechOf = (samples: Float32Array) => totalSec(speechSpans(analyzeSamples(samples, RATE)));
const kit = (id: string, ...p: string[]) => join(WORK, id, "素材", ...p);
const round = (v: number) => Math.round(v * 100) / 100;

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

interface EditKey {
  scenes: { no: number; audio: string; kept: { startSec: number; endSec: number }[]; cuts: { startSec: number; endSec: number }[] }[];
}

type Span = { startSec: number; endSec: number };

/**
 * 2-2：答えで残す所だけを S01 → S05 の順につないだ声（受講者の書き出しと同じ1本）で測る。
 * 消し残しの幅は、消す所を1か所だけ残したときに増える声の量の、いちばん小さい値の6割。
 */
function cutRemoveKey(): PracticeKeys["cut-remove"] {
  const key = JSON.parse(readFileSync(join(RAW, "職員用（受講者に渡さない）", "編集ポイント.json"), "utf8").replace(/^﻿/, "")) as EditKey;
  const scenes = [1, 5].map((no) => {
    const scene = key.scenes.find((x) => x.no === no);
    if (!scene) throw new Error(`編集ポイント.json に場面${no} がありません`);
    return { ...scene, raw: decode(join(RAW, scene.audio)) };
  });
  const gap = new Float32Array(Math.round(0.25 * RATE));
  const build = (extra: { si: number; span: Span } | null) =>
    concat(
      scenes.flatMap((sc, si) =>
        [...sc.kept, ...(extra?.si === si ? [extra.span] : [])]
          .sort((a, b) => a.startSec - b.startSec)
          .flatMap((k) => [sc.raw.slice(Math.round(k.startSec * RATE), Math.round(k.endSec * RATE)), gap]),
      ),
    );
  const clean = speechOf(build(null));
  const added = scenes
    .flatMap((sc, si) => sc.cuts.map((span) => speechOf(build({ si, span })) - clean))
    .filter((v) => v > 0.1); // 沈黙だけの所（録り終わりなど）は声が増えない
  if (added.length === 0) throw new Error("編集ポイント.json に、声の入った消す所がありません");
  return {
    cleanSpeechSec: round(clean),
    rawSpeechSec: round(speechOf(concat(scenes.map((sc) => sc.raw)))),
    extraToleranceSec: round(Math.min(...added) * 0.6),
    // 足りない側は、言葉のきわを 0.1秒ほど詰めて切るぶれ（試しで約0.3秒）より広くとる
    lostToleranceSec: 0.6,
  };
}

/** 2-11：小さく録った場面を元の大きさにもどしてつないだ声で、場面ごとの大きさを測る */
function voiceLevelKey(): PracticeKeys["voice-level"] {
  const scenes = [1, 2, 3].map((no) => {
    const s = decode(kit("voice-level", "音声", `S0${no}_声.wav`));
    return no === VOICE_LEVEL_QUIET.scene ? s.map((v) => v * 10 ** (-VOICE_LEVEL_QUIET.db / 20)) : s;
  });
  const all = new Float32Array(scenes.reduce((n, s) => n + s.length, 0));
  let at = 0;
  const spans = scenes.map((s) => {
    all.set(s, at);
    const span = { start: at / RATE + 0.1, end: (at + s.length) / RATE - 0.1 };
    at += s.length;
    return span;
  });
  const frames = analyzeSamples(all, RATE);
  const levels = spans.map((sp) => speechLevel(frames, speechSpans(frames, sp)));
  return { sceneSec: scenes.map((s) => round(s.length / RATE)), levelDb: levels.map((l) => round(l - levels[0])) };
}

function main(): void {
  const dvDuration = Math.max(durationOf(kit("dv-basics", "映像", "S01_会話.mp4")), durationOf(kit("dv-basics", "音声", "S01_声.wav")));

  const minute = decode(kit("finish-practice", "映像", "練習_1分.mp4"));
  const minuteSpeech = speechSpans(analyzeSamples(minute, RATE));

  const keys: PracticeKeys = {
    "dv-export": { durationSec: round(dvDuration), maxMb: Math.ceil(dvDuration * EXPORT_MB_PER_SEC) },
    "cut-basics": { speechSec: round(speechOf(decode(kit("cut-basics", "音声", "練習_ピー入り.wav")))) },
    "cut-remove": cutRemoveKey(),
    "cut-ma": { speechSec: round(speechOf(decode(kit("cut-ma", "音声", "練習_間.wav")))) },
    bgm: {
      durationSec: round(minute.length / RATE),
      voiceStart: round(minuteSpeech[0].start),
      voiceEnd: round(minuteSpeech[minuteSpeech.length - 1].end),
    },
    "voice-level": voiceLevelKey(),
  };
  writeFileSync(
    OUT,
    [
      "// scripts/practice/buildPracticeKeys.ts が作るファイル。手で書きかえない。",
      'import type { PracticeKeys } from "./keys";',
      "",
      `export const PRACTICE_KEYS: PracticeKeys = ${JSON.stringify(keys, null, 2)};`,
      "",
    ].join("\n"),
  );
  console.log(JSON.stringify(keys, null, 2));
}

main();
