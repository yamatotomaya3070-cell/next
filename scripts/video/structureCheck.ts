/**
 * 構成照合の実行（ffmpeg に依存するためワーカー側に置く）。
 *
 * 支給素材ZIPのセリフ音声を取り出し、完成見本と提出動画のそれぞれで
 * どこに入っているかを fingerprint で探し、checkVoiceStructure に渡す。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrackIndex, findClipInTrack, fingerprint, type ClipMatch } from "../../src/lib/audio/fingerprint";
import { checkVoiceStructure, type VoicePlacement } from "../../src/lib/video/inspection/structure";
import type { CheckItem } from "../../src/lib/video/inspection/types";
import { decodePcmMono8k } from "./pcm";
import { readZipEntries } from "./unzip";

/** 支給素材ZIP内のセリフ音声（素材/音声/S01_02_ミナ先生.wav）。フォルダ名の文字化けに備え、ファイル名だけで判定する */
export const VOICE_FILE_PATTERN = /(^|\/)S\d{2}_\d{2}_[^/]+\.wav$/i;

export interface StructureCheckInput {
  /** 作業フォルダ（音声の一時展開先） */
  workdir: string;
  /** 完成見本のローカルパス（workdir からの相対でも絶対でも可） */
  sampleFile: string;
  /** 提出動画のローカルパス */
  submissionFile: string;
  /** 支給素材一式.zip の中身 */
  assetsZip: Buffer;
}

export interface VoiceMatchDetail {
  name: string;
  /** セリフ音声の長さ（秒）。字幕照合で「セリフの途中」を撮るのに使う */
  durationSec: number;
  inSample: ClipMatch | null;
  inSubmission: ClipMatch[];
}

export interface StructureCheckResult {
  checks: CheckItem[];
  placements: VoicePlacement[];
  /** スコアやカバー率を含む生の照合結果（閾値調整・ログ用） */
  details: VoiceMatchDetail[];
}

/** ZIP からセリフ音声を取り出して workdir/voices に書き、ファイル名一覧を返す */
export function extractVoices(assetsZip: Buffer, workdir: string): string[] {
  const voicesDir = join(workdir, "voices");
  mkdirSync(voicesDir, { recursive: true });
  const entries = readZipEntries(assetsZip, (name) => VOICE_FILE_PATTERN.test(name));
  const names: string[] = [];
  for (const e of entries) {
    const base = e.name.split("/").pop()!;
    writeFileSync(join(voicesDir, base), e.data);
    names.push(base);
  }
  return names.sort();
}

export function runStructureCheck(input: StructureCheckInput): StructureCheckResult {
  const voiceNames = extractVoices(input.assetsZip, input.workdir);
  if (voiceNames.length === 0) {
    return { checks: [], placements: [], details: [] };
  }

  const sampleIndex = buildTrackIndex(fingerprint(decodePcmMono8k(input.sampleFile, input.workdir)));
  const submissionIndex = buildTrackIndex(fingerprint(decodePcmMono8k(input.submissionFile, input.workdir)));

  const details: VoiceMatchDetail[] = voiceNames.map((name) => {
    const clip = fingerprint(decodePcmMono8k(join("voices", name), input.workdir));
    const inSample = findClipInTrack(clip, sampleIndex, { maxMatches: 1 })[0] ?? null;
    const inSubmission = findClipInTrack(clip, submissionIndex, { maxMatches: 3 });
    return { name, durationSec: clip.durationSec, inSample, inSubmission };
  });

  const placements: VoicePlacement[] = details.map((d) => ({
    name: d.name,
    sampleStartSec: d.inSample?.startSec ?? null,
    submissionStarts: d.inSubmission.map((m) => m.startSec).sort((a, b) => a - b),
  }));

  return { checks: checkVoiceStructure(placements), placements, details };
}
