/**
 * 台本JSON生成（工程: generating_script）
 * テンプレート非依存: registry から該当テンプレートのプロンプト/検証/モックを取得して使う。
 * Gemini で生成 → validateTemplateScript で検証。壊れたJSONは1回だけ修復再生成し、
 * それでも失敗する場合はエラー（ワーカーが failed として記録）。
 * GEMINI_API_KEY 未設定時は決定的なモック台本を返す。
 */
import {
  buildScriptPrompt,
  mockTemplateScript,
  validateTemplateScript,
  type AnyVideoScript,
  type VideoTemplateType,
} from "../../src/lib/video/templates";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 90_000;
const MAX_NETWORK_RETRIES = 3;

async function callGeminiOnce(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Gemini API エラー (${res.status}): ${body.slice(0, 300)}`);
    (err as Error & { retryable?: boolean }).retryable = res.status === 429 || res.status >= 500;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini API から空の応答が返されました");
  return text;
}

/** 429/5xx・タイムアウト・ネットワーク断は指数バックオフで再試行する */
async function callGemini(prompt: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_NETWORK_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(prompt);
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof Error &&
        ((err as Error & { retryable?: boolean }).retryable === true ||
          err.name === "TimeoutError" ||
          err.name === "AbortError");
      if (!retryable || attempt === MAX_NETWORK_RETRIES) throw err;
      const waitMs = 2 ** attempt * 1000;
      console.warn(
        `Gemini呼び出しが失敗（試行${attempt}/${MAX_NETWORK_RETRIES}）。${waitMs}ms後に再試行: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

export interface ScriptGenResult {
  script: AnyVideoScript;
  provider: string;
}

export async function generateScript(
  templateType: VideoTemplateType,
  theme: string,
  targetDurationSec: number,
  providerPreference: "auto" | "mock" = "auto",
  caseContext?: string | null,
): Promise<ScriptGenResult> {
  if (providerPreference === "mock" || !process.env.GEMINI_API_KEY) {
    return { script: mockTemplateScript(templateType, theme, targetDurationSec), provider: "mock" };
  }

  let repairNote: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const basePrompt = buildScriptPrompt(templateType, theme, targetDurationSec, repairNote);
    const prompt = caseContext?.trim()
      ? `${basePrompt}

追加の実案件コンテキスト:
"""
${caseContext.trim().slice(0, 12000)}
"""

上記はクラウドワークス等の実案件から抽出した要件です。テーマだけで一般的な説明動画にせず、案件文にある納品形式、尺、媒体、編集ルール、修正されやすい点、クライアントが期待する完成像を台本・画面構成・editingInstructionsへ反映してください。実在の固有名詞、URL、連絡先、報酬額は使わず、匿名化した一般表現に置き換えてください。`
      : basePrompt;
    const json = await callGemini(prompt);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      repairNote = "出力が有効なJSONではありませんでした。JSON以外の文字を含めないでください。";
      continue;
    }
    const result = validateTemplateScript(templateType, parsed);
    if (result.ok && result.script) {
      return { script: result.script, provider: "gemini" };
    }
    repairNote = result.errors.join(" / ");
  }
  throw new Error(`台本JSONの検証に2回失敗しました: ${repairNote}`);
}
