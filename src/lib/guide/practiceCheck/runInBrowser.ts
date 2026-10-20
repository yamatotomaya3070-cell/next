/**
 * ブラウザの中で、えらんだ動画ファイルを調べる（どこにも送らない）。
 * 音は Web Audio で読み直し、analyze.ts と checks.ts で判定する。
 */
import { analyzeSamples, downmix, type AudioFrames } from "./analyze";
import { checkBgm, checkCutBasics, checkCutMa, checkCutRemove, checkExport, checkVoiceLevel, type CheckItem, type PracticeCheckId } from "./checks";
import { PRACTICE_KEYS } from "./keys.generated";

const DECODE_RATE = 48000;
/** これより大きいファイルは練習の書き出しではないので読まない（ブラウザのメモリを守る） */
export const MAX_CHECK_BYTES = 300 * 1024 * 1024;
/** H.264 の印は MP4 の頭か終わり（moov）にあるので、そこだけ見る */
const CODEC_SCAN_BYTES = 4 * 1024 * 1024;
const META_TIMEOUT_MS = 15000;

export class PracticeCheckError extends Error {}

const NO_AUDIO: AudioFrames = { db: new Float32Array(0), peakDb: new Float32Array(0), beepRatio: new Float32Array(0), durationSec: 0 };

function includesAvc1(bytes: Uint8Array): boolean {
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] === 0x61 && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x63 && bytes[i + 3] === 0x31) return true;
  }
  return false;
}

/** MP4 の中に H.264 の印（"avc1"）があるか */
async function isH264(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, CODEC_SCAN_BYTES).arrayBuffer());
  if (includesAvc1(head)) return true;
  if (file.size <= CODEC_SCAN_BYTES) return false;
  return includesAvc1(new Uint8Array(await file.slice(Math.max(CODEC_SCAN_BYTES, file.size - CODEC_SCAN_BYTES)).arrayBuffer()));
}

function readVideoMeta(file: File): Promise<{ width: number; height: number; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = () => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const fail = () => {
      done();
      reject(new PracticeCheckError("この動画は、このブラウザでは再生できません。［コーデック］が「H.264」になっているか見直して、書き出し直します。"));
    };
    const timer = setTimeout(fail, META_TIMEOUT_MS);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const meta = { width: video.videoWidth, height: video.videoHeight, durationSec: video.duration };
      done();
      resolve(meta);
    };
    video.onerror = fail;
    video.src = url;
  });
}

/** 音を読む。音の無いファイルは null */
async function decodeAudio(file: File): Promise<AudioBuffer | null> {
  try {
    const ctx = new OfflineAudioContext(1, 1, DECODE_RATE);
    return await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    return null;
  }
}

const toFrames = (audio: AudioBuffer) =>
  analyzeSamples(downmix(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i))), audio.sampleRate);

async function checkExportFile(file: File): Promise<CheckItem[]> {
  const [meta, h264, audio] = await Promise.all([readVideoMeta(file), isH264(file), decodeAudio(file)]);
  const frames = audio ? toFrames(audio) : NO_AUDIO;
  // 再生の長さが取れないブラウザでは、音の長さで見る
  const durationSec = Number.isFinite(meta.durationSec) ? meta.durationSec : frames.durationSec;
  return checkExport({ ...meta, durationSec, bytes: file.size, isH264: h264 }, frames, PRACTICE_KEYS["dv-export"]);
}

export async function runPracticeCheck(id: PracticeCheckId, file: File): Promise<CheckItem[]> {
  if (file.size > MAX_CHECK_BYTES) throw new PracticeCheckError("ファイルが大きすぎます。練習で書き出した動画をえらびます。");
  if (id === "dv-export") return checkExportFile(file);
  const audio = await decodeAudio(file);
  if (!audio) throw new PracticeCheckError("音を読み取れませんでした。音の入った MP4 で書き出したか見直します（1-5 の設定）。");
  const frames = toFrames(audio);
  switch (id) {
    case "cut-basics":
      return checkCutBasics(frames, PRACTICE_KEYS["cut-basics"]);
    case "cut-remove":
      return checkCutRemove(frames, PRACTICE_KEYS["cut-remove"]);
    case "cut-ma":
      return checkCutMa(frames, PRACTICE_KEYS["cut-ma"]);
    case "bgm":
      return checkBgm(frames, PRACTICE_KEYS.bgm);
    case "voice-level":
      return checkVoiceLevel(frames, PRACTICE_KEYS["voice-level"]);
  }
}
