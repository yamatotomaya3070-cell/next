/**
 * 動画理解のディスパッチ層（AiProvider の index と同じ思想）。
 * GEMINI_API_KEY があれば gemini、無ければ mock。gemini 失敗時は mock にフォールバックし、
 * provider 名で判別可能にする。
 */
import { geminiVideoUnderstanding } from "./gemini";
import { mockVideoUnderstanding } from "./mock";
import type { AnalyzeVideoInput, EditingPattern, VideoUnderstandingProvider } from "./types";

export * from "./types";

function activeProvider(): VideoUnderstandingProvider {
  return process.env.GEMINI_API_KEY ? geminiVideoUnderstanding : mockVideoUnderstanding;
}

/** 動画を解析して編集パターンを返す。gemini 失敗時は mock にフォールバック */
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
