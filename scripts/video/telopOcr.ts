/**
 * 字幕の文字認識（OCR）。ffmpeg で画面下部を切り出し、Gemini に画像として読ませる。
 *
 * 1リクエストに複数の画像を入れて、画像ごとの文字を JSON で返してもらう（呼び出し回数を減らす）。
 * GEMINI_API_KEY が無い環境では null を返し、呼び出し側は「字幕は確認できなかった」扱いにする。
 */
import { spawnSync } from "node:child_process";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_OCR_MODEL = "gemini-2.5-flash";
/** 1リクエストあたりの画像数 */
export const OCR_BATCH_SIZE = 12;
/** 切り出す高さ（画面の下から何割か）。見本の字幕は下端から 15% 前後に出るが、置き方の個人差を見込む */
const STRIP_HEIGHT_RATIO = 0.3;
const STRIP_WIDTH = 720;

/** 動画の t 秒の画面下部を PNG で返す（幅 STRIP_WIDTH に縮小） */
export function extractSubtitleStrip(file: string, cwd: string, atSec: number): Buffer {
  const vf = `crop=iw:ih*${STRIP_HEIGHT_RATIO}:0:ih*${1 - STRIP_HEIGHT_RATIO},scale=${STRIP_WIDTH}:-2`;
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-ss", atSec.toFixed(3), "-i", file, "-frames:v", "1", "-vf", vf, "-f", "image2", "-c:v", "png", "-"],
    { cwd, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw new Error(`ffmpeg の実行に失敗しました（${file}）: ${result.error.message}`);
  const png = result.stdout as Buffer;
  if (!png || png.length === 0) {
    throw new Error(`${file} の ${atSec.toFixed(1)}秒 の画面を取り出せませんでした: ${(result.stderr as Buffer | undefined)?.toString("utf8").slice(-300)}`);
  }
  return png;
}

export function isOcrAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const PROMPT = `これらは動画の画面の下の部分（字幕が出る場所）を切り出した画像です。画像は「画像1」「画像2」…の順に並んでいます。
各画像について、字幕（セリフの文）として表示されている文字を、一字一句そのまま書き出してください。
- 字幕の上や横にある小さな話者名のラベル（例: ナレーション、ミナ先生）は含めない
- 字幕が無い、または文字が読めないときは空文字 "" にする
- 推測で補わない。見えている文字だけを書く
JSON 配列だけを返してください: [{"index": 1, "text": "..."}, ...]`;

interface OcrRow {
  index?: number;
  text?: string;
}

/** 通信エラー・429・5xx のときの再試行回数と待ち時間（一時的な切断1回で検品全体を落とさないため） */
const OCR_RETRY_LIMIT = 3;
const OCR_RETRY_BASE_MS = 2000;

class RetryableOcrError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableOcrError(err: unknown): boolean {
  if (err instanceof RetryableOcrError) return true;
  return err instanceof TypeError && /fetch failed/.test(err.message);
}

async function ocrBatch(images: Buffer[], apiKey: string, model: string): Promise<string[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ocrBatchOnce(images, apiKey, model);
    } catch (err) {
      if (!isRetryableOcrError(err) || attempt >= OCR_RETRY_LIMIT) throw err;
      const waitMs = OCR_RETRY_BASE_MS * attempt;
      const reason = err instanceof Error ? err.message.slice(0, 120) : String(err);
      console.warn(`  Gemini OCR を再試行します（${attempt}/${OCR_RETRY_LIMIT - 1}、${waitMs}ms 後）: ${reason}`);
      await sleep(waitMs);
    }
  }
}

async function ocrBatchOnce(images: Buffer[], apiKey: string, model: string): Promise<string[]> {
  const parts: Array<Record<string, unknown>> = [];
  images.forEach((png, i) => {
    parts.push({ text: `画像${i + 1}:` });
    parts.push({ inline_data: { mime_type: "image/png", data: png.toString("base64") } });
  });
  parts.push({ text: PROMPT });

  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  if (!res.ok) {
    const message = `Gemini OCR エラー (${res.status}): ${(await res.text()).slice(0, 400)}`;
    if (res.status === 429 || res.status >= 500) throw new RetryableOcrError(message);
    throw new Error(message);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini OCR が空応答でした");
  let rows: OcrRow[];
  try {
    const parsed = JSON.parse(text) as unknown;
    rows = Array.isArray(parsed) ? (parsed as OcrRow[]) : [];
  } catch {
    throw new Error(`Gemini OCR の応答が JSON ではありません: ${text.slice(0, 200)}`);
  }
  const out = new Array<string>(images.length).fill("");
  for (const r of rows) {
    const i = Number(r.index) - 1;
    if (Number.isInteger(i) && i >= 0 && i < images.length) out[i] = String(r.text ?? "").trim();
  }
  return out;
}

/**
 * 画像ごとの字幕テキストを返す（順序は入力と同じ）。API キーが無ければ null。
 * 1バッチが失敗しても他のバッチは続け、失敗した画像は "" ではなく例外にする
 * （「文字なし」と「読めなかった」を混同すると入れ忘れの誤判定になるため）。
 */
export async function ocrSubtitleStrips(images: Buffer[]): Promise<string[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_OCR_MODEL || process.env.GEMINI_VIDEO_MODEL || DEFAULT_OCR_MODEL;
  const out: string[] = [];
  for (let i = 0; i < images.length; i += OCR_BATCH_SIZE) {
    const batch = images.slice(i, i + OCR_BATCH_SIZE);
    out.push(...(await ocrBatch(batch, apiKey, model)));
  }
  return out;
}
