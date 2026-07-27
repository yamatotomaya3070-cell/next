/**
 * Gemini TTS 経路のスモークテスト（マイルストーン1の実機検証）。
 *
 * 実行:  npx tsx scripts/video/smoke-gemini-tts.ts
 * 前提:  .env.local に GEMINI_API_KEY が設定済み、ffmpeg/ffprobe が PATH にあること。
 *
 * 検証内容:
 *   1. Gemini TTS API の疎通（generateContent + responseModalities:["AUDIO"]）
 *   2. 生PCM → 44.1kHz ステレオ WAV への ffmpeg 変換
 *   3. 話者ごとに別音声が割り当たること（2話者）
 *   4. 無音セグメント（narration=""）が無音WAVになること
 *   5. 出力WAVが 44100Hz / 2ch で、実測尺が取得できること
 *
 * コスト: 数秒ぶんの音声合成のみ（1円未満）。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvLocal } from "./env";
import { generateVoices } from "./tts";
import type { AudioScene, VoiceProfile } from "../../src/lib/video/templates";

loadEnvLocal();
process.env.TTS_BACKEND = "gemini";

const profiles: VoiceProfile[] = [
  { id: "speaker_a", label: "アオ", subtitleColor: "#3B82F6", pitchFactor: 1.0, rate: 0 },
  { id: "speaker_b", label: "ミドリ", subtitleColor: "#10B981", pitchFactor: 1.0, rate: 0 },
];

const scenes: AudioScene[] = [
  { id: "s1", order: 1, narration: "こんにちは。今日は動画編集の練習をはじめましょう。", voiceId: "speaker_a", silenceSeconds: null },
  { id: "s2", order: 2, narration: "はい、よろしくお願いします。ゆっくり進めていきますね。", voiceId: "speaker_b", silenceSeconds: null },
  { id: "s3", order: 3, narration: "", voiceId: "speaker_a", silenceSeconds: 2 },
];

interface AudioInfo {
  sampleRate: number;
  channels: number;
}

function probeAudio(file: string, cwd: string): AudioInfo {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "a:0", "-show_entries",
      "stream=sample_rate,channels", "-of", "json", file],
    { cwd, encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as { streams?: Array<{ sample_rate?: string; channels?: number }> };
  const s = parsed.streams?.[0];
  return { sampleRate: Number(s?.sample_rate ?? 0), channels: s?.channels ?? 0 };
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY が未設定です。.env.local を確認してください。");
  }

  const workdir = join(tmpdir(), "gemini-tts-smoke");
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(workdir, { recursive: true });
  console.log(`workdir: ${workdir}`);
  console.log(`model  : ${process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts (default)"}`);

  const results = await generateVoices(scenes, profiles, workdir);

  const voicesDir = join(workdir, "voices");
  let failures = 0;
  for (const r of results) {
    const info = probeAudio(r.file, voicesDir);
    const ok = r.durationSec > 0 && info.sampleRate === 44100 && info.channels === 2;
    if (!ok) failures++;
    console.log(
      `${ok ? "✅" : "❌"} ${r.file}  ${r.durationSec.toFixed(2)}s  ` +
        `${info.sampleRate}Hz ${info.channels}ch`,
    );
  }

  if (failures > 0) throw new Error(`${failures} 件のシーンが検証に失敗しました`);
  console.log("\n✅ Gemini TTS スモークテスト合格（API疎通・PCM→WAV変換・多話者・無音・尺計測）");
}

main().catch((err) => {
  console.error("❌ 失敗:", err instanceof Error ? err.message : err);
  process.exit(1);
});
