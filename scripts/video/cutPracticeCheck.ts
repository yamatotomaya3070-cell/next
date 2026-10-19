/**
 * カット練習の案件の検品の実行（ffmpeg と Gemini に依存するためワーカー側に置く）。
 *
 * 支給素材ZIPの「録ったままの声」（素材/音声/S01_収録.wav）と答え（編集ポイント.json）から、
 *   - 残すセリフの音 → 提出動画のどこにあるか（欠け・順番・間・声の大きさ）
 *   - わざと入れた消す声の音 → 提出動画に残っていないか
 * を音声指紋で探し、src/lib/video/inspection/cutPractice.ts で判定する。字幕は台本の文と比べる。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrackIndex, findClipInTrack, fingerprint, FINGERPRINT_SAMPLE_RATE, type ClipMatch, type TrackIndex } from "../../src/lib/audio/fingerprint";
import {
  checkCutPractice,
  type CutLineObservation,
  type RemnantObservation,
  type SceneLevel,
} from "../../src/lib/video/inspection/cutPractice";
import type { CheckItem } from "../../src/lib/video/inspection/types";
import { NG_CLIPS } from "../../src/lib/scene/rawTakes";
import type { EditKey } from "../scene/buildRawPackage";
import { decodePcmMono8k } from "./pcm";
import type { VoiceMatchDetail } from "./structureCheck";
import { runTelopCheck } from "./telopCheck";
import { readZipEntries } from "./unzip";

/** 支給素材ZIP内の録ったままの声（フォルダ名の文字化けに備え、ファイル名だけで判定する） */
const RAW_VOICE_PATTERN = /(^|\/)S(\d{2})_収録\.wav$/;
/** 一致とみなすのに届かなくても、ほぼ全体が合っていれば入っているとみなすカバー率 */
const NEAR_MISS_OPTIONS = { maxMatches: 1, minScore: 0.12, minCoverage: 0.85 } as const;
/** これより短い消す声は、手がかりが少なすぎるので探さない（秒） */
const MIN_REMNANT_SEC = 0.25;
/** 消す声を探すときの一致の下限（ふつうの 0.25 より厳しくする。別の人の似た声を拾わないように） */
const REMNANT_MIN_SCORE = 0.35;

export interface CutPracticeCheckInput {
  workdir: string;
  submissionFile: string;
  assetsZip: Buffer;
  editKey: EditKey;
}

export interface CutPracticeCheckResult {
  checks: CheckItem[];
  lines: CutLineObservation[];
  remnants: RemnantObservation[];
  levels: SceneLevel[];
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const slice = (pcm: Float32Array, startSec: number, endSec: number) =>
  pcm.subarray(Math.max(0, Math.floor(startSec * FINGERPRINT_SAMPLE_RATE)), Math.min(pcm.length, Math.ceil(endSec * FINGERPRINT_SAMPLE_RATE)));

function rmsDb(pcm: Float32Array): number | null {
  if (pcm.length === 0) return null;
  let sum = 0;
  for (const v of pcm) sum += v * v;
  const rms = Math.sqrt(sum / pcm.length);
  return rms > 0 ? 20 * Math.log10(rms) : null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function find(clipPcm: Float32Array, index: TrackIndex): { match: ClipMatch | null; durationSec: number } {
  const fp = fingerprint(clipPcm);
  const match = findClipInTrack(fp, index, { maxMatches: 1 })[0] ?? findClipInTrack(fp, index, NEAR_MISS_OPTIONS)[0] ?? null;
  return { match, durationSec: fp.durationSec };
}

/** ZIP から録ったままの声を取り出し、場面番号 → 8kHz の音 を返す */
function loadRawVoices(assetsZip: Buffer, workdir: string): Map<number, Float32Array> {
  const dir = join(workdir, "raw");
  mkdirSync(dir, { recursive: true });
  const out = new Map<number, Float32Array>();
  for (const e of readZipEntries(assetsZip, (name) => RAW_VOICE_PATTERN.test(name))) {
    const scene = Number(RAW_VOICE_PATTERN.exec(e.name)![2]);
    const file = `S${pad2(scene)}_収録.wav`;
    writeFileSync(join(dir, file), e.data);
    out.set(scene, decodePcmMono8k(join("raw", file), workdir));
  }
  return out;
}

export async function runCutPracticeCheck(input: CutPracticeCheckInput): Promise<CutPracticeCheckResult> {
  const badScene = input.editKey.scenes?.find((s) => !Array.isArray(s.kept) || !Array.isArray(s.ngVoices) || typeof s.gainDb !== "number");
  if (!Array.isArray(input.editKey.scenes) || badScene) throw new Error("答え（edit_key.json）の形が古いか、こわれています。案件を作り直してください");
  const raw = loadRawVoices(input.assetsZip, input.workdir);
  if (raw.size === 0) throw new Error("支給素材に録ったままの声（素材/音声/S01_収録.wav …）がありません");
  const submission = decodePcmMono8k(input.submissionFile, input.workdir);
  const index = buildTrackIndex(fingerprint(submission));

  const lines: CutLineObservation[] = [];
  const voices: VoiceMatchDetail[] = [];
  const expectations = new Map<string, string>();
  const levelsByScene = new Map<number, number[]>();
  const ngSeen = new Map<string, { scene: number; startSec: number; endSec: number; kind: string; gainDb: number }>();

  for (const scene of input.editKey.scenes) {
    const pcm = raw.get(scene.no);
    if (!pcm) throw new Error(`支給素材に場面${scene.no}の声がありません`);
    scene.kept.forEach((k, i) => {
      const { match, durationSec } = find(slice(pcm, k.startSec, k.endSec), index);
      const startSec = match?.startSec ?? null;
      lines.push({ scene: scene.no, text: k.text, durationSec, startSec });
      // 字幕の照合用の名前（S01_02_ミナ先生.wav の形にすると、利用者への文で「S01_02（ミナ先生）」と出る）
      const name = `S${pad2(scene.no)}_${pad2(i + 1)}_${k.speakerJa}.wav`;
      voices.push({ name, durationSec, inSample: null, inSubmission: match ? [match] : [], nearMiss: null });
      expectations.set(name, k.text);
      if (startSec !== null) {
        // もとの声にくらべた大きさ。録るときに下げた分（gainDb）を足しもどすと、そろえてあればどの場面も同じになる
        const sub = rmsDb(slice(submission, startSec, startSec + durationSec));
        const orig = rmsDb(slice(pcm, k.startSec, k.endSec));
        if (sub !== null && orig !== null) {
          levelsByScene.set(scene.no, [...(levelsByScene.get(scene.no) ?? []), sub - orig + scene.gainDb]);
        }
      }
    });
    // 同じ人の同じ声は、どの場面でも同じ音なので、1つで探せば足りる。小さく録った場面のものは、ほかがあればそちらを使う
    for (const v of scene.ngVoices) {
      const id = `${v.speaker}/${v.clip}`;
      const prev = ngSeen.get(id);
      if (!prev || (prev.gainDb < 0 && scene.gainDb === 0)) {
        ngSeen.set(id, { scene: scene.no, startSec: v.startSec, endSec: v.endSec, kind: v.kind, gainDb: scene.gainDb });
      }
    }
  }

  const remnants: RemnantObservation[] = [];
  for (const [id, v] of ngSeen) {
    if (v.endSec - v.startSec < MIN_REMNANT_SEC) continue;
    const fp = fingerprint(slice(raw.get(v.scene)!, v.startSec, v.endSec));
    const found = findClipInTrack(fp, index, { maxMatches: 5, minScore: REMNANT_MIN_SCORE });
    const clip = NG_CLIPS.find((c) => c.id === id.split("/")[1]);
    remnants.push({ kindJa: v.kind, text: clip?.text ?? id, durationSec: fp.durationSec, found: found.map((m) => ({ atSec: m.startSec, score: m.score })) });
  }

  const levels: SceneLevel[] = input.editKey.scenes.map((s) => ({ scene: s.no, db: median(levelsByScene.get(s.no) ?? []) }));

  const telop = await runTelopCheck({
    workdir: input.workdir,
    submissionFile: input.submissionFile,
    instructionText: null,
    expectations,
    // 1文字の誤字は見ない（文字認識が読みながら直してしまい、誤字を見逃す・正しい字幕を疑う、の両方が起きた）。
    // 字幕が無い・明らかに違う文だけを機械で見て、誤字は職員が見る
    options: { source: "台本", partial: true },
    voices,
    voiceDurations: Object.fromEntries(voices.map((v) => [v.name, v.durationSec])),
  });
  if (telop.skippedReason) console.log(`  字幕照合: ${telop.skippedReason}`);

  return { checks: [...checkCutPractice({ lines, remnants, levels }), ...telop.checks], lines, remnants, levels };
}
