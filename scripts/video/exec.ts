/** ffmpeg / ffprobe / PowerShell 実行の共通ヘルパー */
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

/** コマンドを実行し、stderr をログファイルに保存する（ffmpegのエラー解析用） */
export function run(cmd: string, args: string[], cwd: string, logName = "commands.log"): void {
  try {
    const stderr = execFileSync(cmd, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    void stderr;
  } catch (err) {
    const stderrText =
      err instanceof Error && "stderr" in err
        ? String((err as { stderr?: Buffer }).stderr ?? "")
        : String(err);
    appendFileSync(
      join(cwd, logName),
      `\n===== FAILED: ${cmd} ${args.join(" ")}\n${stderrText}\n`,
      "utf8",
    );
    throw new Error(
      `${cmd} が失敗しました: ${stderrText.slice(-500) || String(err)}`,
    );
  }
}

export function probeDurationSec(file: string, cwd: string): number {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { cwd, encoding: "utf8" },
  );
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe が ${file} の長さを取得できませんでした`);
  }
  return seconds;
}

export interface ProbeStreams {
  hasVideo: boolean;
  hasAudio: boolean;
  width: number | null;
  height: number | null;
  durationSec: number;
}

/** 生成MP4が再生可能か検証する（completed 前の必須チェック） */
export function probeStreams(file: string, cwd: string): ProbeStreams {
  const out = execFileSync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "stream=codec_type,width,height",
      "-of", "json", file,
    ],
    { cwd, encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  };
  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  return {
    hasVideo: Boolean(video),
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    width: video?.width ?? null,
    height: video?.height ?? null,
    durationSec: probeDurationSec(file, cwd),
  };
}

export interface VolumeProbe {
  meanVolumeDb: number | null;
  maxVolumeDb: number | null;
}

/**
 * 音量を解析する（ffmpeg volumedetect）。
 * volumedetect は解析結果を stderr に出すため、execFileSync ではなく
 * spawnSync で stderr を捕捉する。
 */
export function probeVolumeDb(file: string, cwd: string): VolumeProbe {
  const result = spawnSync(
    "ffmpeg",
    ["-i", file, "-af", "volumedetect", "-f", "null", "-"],
    { cwd, encoding: "utf8" },
  );
  if (result.error) {
    throw new Error(`ffmpeg(volumedetect) の実行に失敗しました: ${result.error.message}`);
  }
  const stderr = result.stderr ?? "";
  const meanMatch = stderr.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
  const maxMatch = stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
  return {
    meanVolumeDb: meanMatch ? parseFloat(meanMatch[1]) : null,
    maxVolumeDb: maxMatch ? parseFloat(maxMatch[1]) : null,
  };
}
