/**
 * TTS音声生成（工程: generating_voice）
 *
 * 3系統をサポートする。選択は resolveTtsBackend() が次の優先順で決める:
 *   1. TTS_BACKEND=gemini|voicevox|sapi … 明示指定（最優先）
 *   2. GEMINI_TTS_MODEL か GEMINI_TTS=1 が設定 … Gemini TTS
 *   3. VOICEVOX_URL が設定               … VOICEVOX エンジン（HTTP）
 *   4. いずれも無し                       … Windows SAPI（開発機の後方互換）
 *
 *   - Gemini TTS … 日本語ネイティブ品質のクラウド合成。既存の GEMINI_API_KEY を流用。
 *                  本番の既定候補（Windows非依存・自然な音声）。
 *   - VOICEVOX   … セルフホストのHTTPエンジン。クロスプラットフォーム。
 *   - SAPI       … Microsoft Haruka。ローカル開発の後方互換のみ。
 *
 * どの経路でも、シーンごとに 44.1kHz ステレオの WAV を voices/ に生成する（後段の
 * 字幕・レンダリングは実測尺を使うため、経路差はタイミングに影響しない）。
 * 声の演じ分け:
 *   - Gemini   … 話者ごとに別のプリセット音声を割り当てる（voiceProfile順／env上書き可）。
 *                pitchFactor/rate は使わない（音声側で自然に差が付く）。
 *   - VOICEVOX … 話者ID + pitchScale / speedScale（ネイティブ指定）。
 *   - SAPI     … rate + ffmpeg の asetrate によるピッチシフト（従来どおり）。
 * narration===""（無音セグメント。interview_editのみ）は無音WAVを生成する。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AudioScene, VoiceProfile } from "../../src/lib/video/templates";
import { probeDurationSec, run } from "./exec";

const SAMPLE_RATE = 44100;

// VOICEVOX の既定話者。3 = ずんだもん（ノーマル）。ほぼ全バージョンに存在する安全な既定値。
// 話者を変えたい場合は環境変数で上書きできる（コード改修不要）:
//   VOICEVOX_SPEAKER=<id>                … 全プロファイル共通の既定
//   VOICEVOX_SPEAKER_<profileId>=<id>    … 個別プロファイル指定（例 VOICEVOX_SPEAKER_speaker_a=13）
const DEFAULT_VOICEVOX_SPEAKER = 3;
const VOICEVOX_TIMEOUT_MS = 120_000;

export interface SceneAudio {
  sceneId: string;
  file: string; // voices/ 内の相対ファイル名
  durationSec: number;
}

function sceneWavName(order: number, voiceId: string): string {
  return `scene_${String(order).padStart(3, "0")}_${voiceId}.wav`;
}

function silenceWav(outName: string, seconds: number, voicesDir: string): void {
  run(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", `anullsrc=r=${SAMPLE_RATE}:cl=stereo`, "-t", String(seconds), outName],
    voicesDir,
  );
}

// ---- VOICEVOX 経路 -----------------------------------------------------------

function voicevoxSpeakerFor(profile: VoiceProfile | undefined): number {
  if (profile) {
    const perProfile = process.env[`VOICEVOX_SPEAKER_${profile.id}`];
    if (perProfile && Number.isFinite(Number(perProfile))) return Number(perProfile);
  }
  const global = process.env.VOICEVOX_SPEAKER;
  if (global && Number.isFinite(Number(global))) return Number(global);
  return DEFAULT_VOICEVOX_SPEAKER;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** VOICEVOX の audio_query→synthesis で 1 セグメントを合成し WAV バイト列を返す */
async function voicevoxSynthesize(
  text: string,
  speaker: number,
  speedScale: number,
  pitchScale: number,
  baseUrl: string,
): Promise<Buffer> {
  const queryRes = await fetch(
    `${baseUrl}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`,
    { method: "POST", signal: AbortSignal.timeout(VOICEVOX_TIMEOUT_MS) },
  );
  if (!queryRes.ok) {
    throw new Error(`VOICEVOX audio_query に失敗 (${queryRes.status}): ${(await queryRes.text()).slice(0, 200)}`);
  }
  const query = (await queryRes.json()) as Record<string, unknown>;
  query.speedScale = speedScale;
  query.pitchScale = pitchScale;
  query.outputSamplingRate = SAMPLE_RATE;
  query.outputStereo = true;

  const synthRes = await fetch(`${baseUrl}/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/wav" },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(VOICEVOX_TIMEOUT_MS),
  });
  if (!synthRes.ok) {
    throw new Error(`VOICEVOX synthesis に失敗 (${synthRes.status}): ${(await synthRes.text()).slice(0, 200)}`);
  }
  return Buffer.from(await synthRes.arrayBuffer());
}

async function synthesizeVoicevox(
  scenes: AudioScene[],
  profiles: VoiceProfile[],
  voicesDir: string,
  baseUrl: string,
): Promise<void> {
  for (const scene of scenes) {
    const outName = sceneWavName(scene.order, scene.voiceId);
    if (scene.narration.length === 0) {
      silenceWav(outName, scene.silenceSeconds ?? 3, voicesDir);
      continue;
    }
    const profile = profiles.find((p) => p.id === scene.voiceId);
    const speaker = voicevoxSpeakerFor(profile);
    // pitchFactor(1.0基準) → pitchScale(有効域 ±0.15) / rate(小整数) → speedScale
    const pitchScale = clamp((profile?.pitchFactor ?? 1.0) - 1.0, -0.15, 0.15);
    const speedScale = clamp(1.0 + (profile?.rate ?? 0) * 0.06, 0.5, 2.0);
    const wav = await voicevoxSynthesize(scene.narration, speaker, speedScale, pitchScale, baseUrl);
    writeFileSync(join(voicesDir, outName), wav);
  }
}

// ---- Windows SAPI 経路（後方互換） -------------------------------------------

function synthesizeSapiRaw(scenes: AudioScene[], profiles: VoiceProfile[], voicesDir: string): void {
  const manifest = scenes
    .filter((s) => s.narration.length > 0)
    .map((s) => {
      const profile = profiles.find((p) => p.id === s.voiceId);
      return { wav: `raw_${sceneWavName(s.order, s.voiceId)}`, text: s.narration, rate: profile?.rate ?? 0 };
    });
  writeFileSync(join(voicesDir, "manifest.json"), JSON.stringify(manifest), "utf8");

  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 manifest.json | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $synth.SelectVoice('Microsoft Haruka Desktop') } catch { }
foreach ($item in $items) {
  $synth.Rate = $item.rate
  $synth.SetOutputToWaveFile($item.wav)
  $synth.Speak($item.text)
}
$synth.SetOutputToNull()
$synth.Dispose()
`;
  writeFileSync(join(voicesDir, "tts.ps1"), "﻿" + ps, "utf8");
  run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "tts.ps1"], voicesDir);
}

/**
 * SAPI出力(22050Hz mono)を最終WAV(44.1kHz stereo)へ変換する。
 * pitchFactor!=1.0 のときは asetrate でピッチシフトし atempo で速度を戻す。
 */
function finalizeSapiSceneWav(rawName: string, outName: string, pitchFactor: number, voicesDir: string): void {
  const filters =
    pitchFactor !== 1.0
      ? `aresample=${SAMPLE_RATE},asetrate=${SAMPLE_RATE}*${pitchFactor},aresample=${SAMPLE_RATE},atempo=${(1 / pitchFactor).toFixed(6)}`
      : `aresample=${SAMPLE_RATE}`;
  run("ffmpeg", ["-y", "-i", rawName, "-af", filters, "-ar", String(SAMPLE_RATE), "-ac", "2", outName], voicesDir);
}

function synthesizeSapi(scenes: AudioScene[], profiles: VoiceProfile[], voicesDir: string): void {
  synthesizeSapiRaw(scenes, profiles, voicesDir);
  for (const scene of scenes) {
    const outName = sceneWavName(scene.order, scene.voiceId);
    if (scene.narration.length === 0) {
      silenceWav(outName, scene.silenceSeconds ?? 3, voicesDir);
      continue;
    }
    const profile = profiles.find((p) => p.id === scene.voiceId);
    finalizeSapiSceneWav(`raw_${outName}`, outName, profile?.pitchFactor ?? 1.0, voicesDir);
  }
}

// ---- Gemini TTS 経路 ---------------------------------------------------------

const GEMINI_TTS_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// 既定のTTSモデル。新しい preview 版に差し替えたい場合は GEMINI_TTS_MODEL で上書きする
// （例: gemini-3.1-flash-tts-preview）。
const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
// 話者に割り当てるGeminiプリセット音声。voiceProfileの並び順で割り当て、
// GEMINI_TTS_VOICE_<profileId> で個別上書きできる（例 GEMINI_TTS_VOICE_speaker_a=Kore）。
const DEFAULT_GEMINI_VOICES = ["Kore", "Puck", "Charon", "Aoede"];
const GEMINI_TTS_TIMEOUT_MS = 120_000;
const GEMINI_TTS_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** voiceProfile → Geminiプリセット音声名の対応表を作る（env上書き対応） */
function geminiVoiceMap(profiles: VoiceProfile[]): Map<string, string> {
  const map = new Map<string, string>();
  profiles.forEach((profile, index) => {
    const override = process.env[`GEMINI_TTS_VOICE_${profile.id}`];
    map.set(
      profile.id,
      override && override.trim()
        ? override.trim()
        : DEFAULT_GEMINI_VOICES[index % DEFAULT_GEMINI_VOICES.length],
    );
  });
  return map;
}

interface GeminiPcm {
  pcm: Buffer;
  sampleRate: number;
}

/** Gemini TTS で1セグメントを合成し、生PCM（16bit mono）と実サンプルレートを返す */
async function geminiTtsSynthesize(
  text: string,
  voiceName: string,
  model: string,
  apiKey: string,
): Promise<GeminiPcm> {
  const res = await fetch(`${GEMINI_TTS_API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
    signal: AbortSignal.timeout(GEMINI_TTS_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Gemini TTS API エラー (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
  };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const base64 = part?.inlineData?.data;
  if (!base64) throw new Error("Gemini TTS から音声データが返されませんでした");
  // mimeType 例: "audio/L16;codec=pcm;rate=24000"。rate を拾えなければ既定24kHz。
  const rateMatch = (part?.inlineData?.mimeType ?? "").match(/rate=(\d+)/);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  return { pcm: Buffer.from(base64, "base64"), sampleRate };
}

/** 一時的な失敗（429/5xx/timeout）に備えた指数バックオフ付きリトライ */
async function geminiTtsWithRetry(
  text: string,
  voiceName: string,
  model: string,
  apiKey: string,
): Promise<GeminiPcm> {
  let lastError: unknown;
  for (let attempt = 0; attempt < GEMINI_TTS_RETRIES; attempt++) {
    try {
      return await geminiTtsSynthesize(text, voiceName, model, apiKey);
    } catch (err) {
      lastError = err;
      if (attempt < GEMINI_TTS_RETRIES - 1) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function synthesizeGemini(
  scenes: AudioScene[],
  profiles: VoiceProfile[],
  voicesDir: string,
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です（Gemini TTS）");
  const model = process.env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL;
  const voiceMap = geminiVoiceMap(profiles);

  for (const scene of scenes) {
    const outName = sceneWavName(scene.order, scene.voiceId);
    if (scene.narration.length === 0) {
      silenceWav(outName, scene.silenceSeconds ?? 3, voicesDir);
      continue;
    }
    const voiceName = voiceMap.get(scene.voiceId) ?? DEFAULT_GEMINI_VOICES[0];
    const { pcm, sampleRate } = await geminiTtsWithRetry(scene.narration, voiceName, model, apiKey);
    // 生PCMを一時保存し、ffmpegで既存規約(44.1kHzステレオWAV)へ変換する
    const pcmName = `raw_${String(scene.order).padStart(3, "0")}_${scene.voiceId}.pcm`;
    writeFileSync(join(voicesDir, pcmName), pcm);
    run(
      "ffmpeg",
      ["-y", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", pcmName,
        "-ar", String(SAMPLE_RATE), "-ac", "2", outName],
      voicesDir,
    );
  }
}

// ---- バックエンド選択 --------------------------------------------------------

type TtsBackend = "gemini" | "voicevox" | "sapi";

/** 使用するTTSバックエンドを環境変数から決定する（ファイル冒頭のドキュメント参照） */
function resolveTtsBackend(): TtsBackend {
  const explicit = process.env.TTS_BACKEND?.toLowerCase();
  if (explicit === "gemini" || explicit === "voicevox" || explicit === "sapi") return explicit;
  if (process.env.GEMINI_TTS_MODEL || process.env.GEMINI_TTS === "1") return "gemini";
  if (process.env.VOICEVOX_URL) return "voicevox";
  return "sapi";
}

// ---- エントリポイント --------------------------------------------------------

/** 台本の全シーン音声を生成し、実測尺つきで返す。生成済みならスキップ（再開対応） */
export async function generateVoices(
  scenes: AudioScene[],
  profiles: VoiceProfile[],
  workdir: string,
): Promise<SceneAudio[]> {
  const voicesDir = join(workdir, "voices");
  mkdirSync(voicesDir, { recursive: true });

  const allExist = scenes.every((s) => existsSync(join(voicesDir, sceneWavName(s.order, s.voiceId))));
  if (!allExist) {
    const backend = resolveTtsBackend();
    if (backend === "gemini") {
      await synthesizeGemini(scenes, profiles, voicesDir);
    } else if (backend === "voicevox") {
      const voicevoxUrl = process.env.VOICEVOX_URL;
      if (!voicevoxUrl) throw new Error("TTS_BACKEND=voicevox ですが VOICEVOX_URL が未設定です");
      await synthesizeVoicevox(scenes, profiles, voicesDir, voicevoxUrl.replace(/\/$/, ""));
    } else {
      synthesizeSapi(scenes, profiles, voicesDir);
    }
  }

  return scenes.map((scene) => {
    const file = sceneWavName(scene.order, scene.voiceId);
    return { sceneId: scene.id, file, durationSec: probeDurationSec(file, voicesDir) };
  });
}
