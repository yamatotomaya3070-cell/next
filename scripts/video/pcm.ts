/** ffmpeg で音声を 8kHz モノラルの PCM に落とす（fingerprint の入力） */
import { spawnSync } from "node:child_process";
import { FINGERPRINT_SAMPLE_RATE } from "../../src/lib/audio/fingerprint";

/** 10分の動画でも 8kHz×2byte なら 10MB 程度。余裕を持って 512MB まで受ける */
const MAX_PCM_BYTES = 512 * 1024 * 1024;

/**
 * 動画/音声ファイルの音声を Float32Array(-1..1) で返す。
 * 音声トラックが無い場合は空配列（例外にしない。検品側で「音声なし」と扱う）。
 */
export function decodePcmMono8k(file: string, cwd: string): Float32Array {
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(FINGERPRINT_SAMPLE_RATE), "-f", "s16le", "-"],
    { cwd, maxBuffer: MAX_PCM_BYTES },
  );
  if (result.error) {
    throw new Error(`ffmpeg の実行に失敗しました（${file}）: ${result.error.message}`);
  }
  const stdout = result.stdout as Buffer;
  if (result.status !== 0 && (!stdout || stdout.length === 0)) {
    const stderr = (result.stderr as Buffer | undefined)?.toString("utf8") ?? "";
    if (/does not contain any stream|Output file is empty|Stream map .* matches no streams/i.test(stderr)) {
      return new Float32Array(0);
    }
    throw new Error(`ffmpeg が音声を取り出せませんでした（${file}）: ${stderr.slice(-300)}`);
  }
  const sampleCount = Math.floor(stdout.length / 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) out[i] = stdout.readInt16LE(i * 2) / 32768;
  return out;
}
