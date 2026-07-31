/**
 * 動画理解のディスパッチ層（AiProvider の index と同じ思想）。
 * GEMINI_API_KEY があれば gemini、無ければ mock。gemini 失敗時は mock にフォールバックし、
 * provider 名で判別可能にする。
 */
import { geminiVideoUnderstanding } from "./gemini";
import { analyzeViaFilesApi } from "./geminiFiles";
import { mockVideoUnderstanding } from "./mock";
import type { AnalyzeVideoInput, EditingPattern, VideoUnderstandingProvider } from "./types";

export * from "./types";

function activeProvider(): VideoUnderstandingProvider {
  return process.env.GEMINI_API_KEY ? geminiVideoUnderstanding : mockVideoUnderstanding;
}

/** 動画を解析して編集パターンを返す。gemini 失敗時は mock にフォールバック（inline版・20MB未満想定） */
export async function analyzeVideo(
  input: AnalyzeVideoInput,
): Promise<EditingPattern & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.analyze(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini動画理解に失敗。モックにフォールバックします:", err);
      const result = await mockVideoUnderstanding.analyze(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}

export interface AnalyzeVideoBytesInput {
  bytes: Uint8Array;
  mimeType: string;
  hint?: string;
  displayName?: string;
  maxWaitMs?: number;
}

/**
 * 動画のバイト列を Files API で解析する（ffmpeg 不要・大容量可）。
 * GEMINI_API_KEY が無ければ mock、gemini 失敗時も mock にフォールバックする。
 * Vercel 上のクラウド解析（ingestProcessor）から使う想定。
 */
export async function analyzeVideoBytes(
  input: AnalyzeVideoBytesInput,
): Promise<EditingPattern & { provider: string }> {
  if (!process.env.GEMINI_API_KEY) {
    const result = await mockVideoUnderstanding.analyze({
      videoBase64: "",
      mimeType: input.mimeType,
      hint: input.hint,
    });
    return { ...result, provider: "mock" };
  }
  try {
    const result = await analyzeViaFilesApi(input);
    return { ...result, provider: "gemini" };
  } catch (err) {
    console.error("Gemini動画理解(Files API)に失敗。モックにフォールバックします:", err);
    const result = await mockVideoUnderstanding.analyze({
      videoBase64: "",
      mimeType: input.mimeType,
      hint: input.hint,
    });
    return { ...result, provider: "mock(fallback)" };
  }
}
