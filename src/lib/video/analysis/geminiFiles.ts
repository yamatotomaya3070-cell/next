/**
 * Gemini Files API による動画理解（ffmpeg 不要のクラウド解析経路）。
 *
 * inline_data は 20MB 未満に縮小する必要があり、そのために ffmpeg ワーカーが必須だった。
 * Files API は動画をそのままアップロードして Google 側で前処理するため、縮小が不要になり、
 * Vercel（Node ランタイム）上で解析を完結できる＝常駐ワーカー機が不要になる。
 *
 * 手順: resumable upload → state が ACTIVE になるまでポーリング → file_data で generateContent。
 * 動画対応モデルが必要: 既定 gemini-2.5-flash（GEMINI_VIDEO_MODEL で上書き可）。
 */
import type { EditingPattern } from "./types";
import { buildAnalysisPrompt, coercePattern, extractGeneratedText } from "./geminiShared";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const DEFAULT_VIDEO_MODEL = "gemini-2.5-flash";

const POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_WAIT_MS = 200_000; // ACTIVE 待ちの上限（呼び出し側の実行時間予算で上書き可）

export interface FilesApiInput {
  bytes: Uint8Array;
  mimeType: string;
  hint?: string;
  displayName?: string;
  maxWaitMs?: number;
}

interface UploadedFile {
  name: string; // 例: "files/abc123"（状態取得・削除に使う）
  uri: string; // generateContent の file_uri に渡す
  state: string; // PROCESSING | ACTIVE | FAILED
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** resumable プロトコルで動画をアップロードする */
async function uploadFile(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  displayName: string,
): Promise<UploadedFile> {
  const numBytes = bytes.byteLength;

  const start = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(numBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) {
    throw new Error(`Files APIアップロード開始に失敗 (${start.status}): ${(await start.text()).slice(0, 300)}`);
  }
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Files APIのアップロードURLが取得できませんでした");

  const finalize = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    // 生バイト送信（メディアタイプは start 側の X-Goog-Upload-Header-Content-Type で宣言済み）。
    // Node の fetch は Uint8Array を body に取れるが DOM 型が許さないためキャストする。
    body: bytes as unknown as BodyInit,
  });
  if (!finalize.ok) {
    throw new Error(`Files APIアップロードに失敗 (${finalize.status}): ${(await finalize.text()).slice(0, 300)}`);
  }
  const data = await finalize.json();
  const file = (data as { file?: { name?: string; uri?: string; state?: string } })?.file;
  if (!file?.name || !file?.uri) throw new Error("Files APIのアップロード応答が不正です");
  return { name: file.name, uri: file.uri, state: file.state ?? "PROCESSING" };
}

/** ファイルの現在状態を取得する */
async function getFileState(apiKey: string, name: string): Promise<{ state: string; uri: string }> {
  const res = await fetch(`${API_BASE}/${name}`, { headers: { "x-goog-api-key": apiKey } });
  if (!res.ok) {
    throw new Error(`Files API状態取得に失敗 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    state: (data as { state?: string })?.state ?? "PROCESSING",
    uri: (data as { uri?: string })?.uri ?? "",
  };
}

/** アップロード済みファイルを削除する（失敗しても無視＝48hで自動失効するため） */
async function deleteFile(apiKey: string, name: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/${name}`, { method: "DELETE", headers: { "x-goog-api-key": apiKey } });
  } catch {
    // ベストエフォート
  }
}

/** Files API 経由で動画を解析し編集パターンを返す */
export async function analyzeViaFilesApi(input: FilesApiInput): Promise<EditingPattern> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です（動画理解 Files API）");
  const model = process.env.GEMINI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL;
  const maxWaitMs = input.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;

  const uploaded = await uploadFile(apiKey, input.bytes, input.mimeType, input.displayName ?? "ingest");
  try {
    // ACTIVE になるまで待つ（Google側の前処理。短尺なら数秒〜十数秒）
    let state = uploaded.state;
    let uri = uploaded.uri;
    const deadline = Date.now() + maxWaitMs;
    while (state === "PROCESSING") {
      if (Date.now() > deadline) {
        throw new Error("動画の前処理がタイムアウトしました（長尺・大容量すぎる可能性）");
      }
      await sleep(POLL_INTERVAL_MS);
      const s = await getFileState(apiKey, uploaded.name);
      state = s.state;
      if (s.uri) uri = s.uri;
    }
    if (state !== "ACTIVE") {
      throw new Error(`動画ファイルの状態が ${state} でした（ACTIVE になりませんでした）`);
    }

    const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { file_data: { mime_type: input.mimeType, file_uri: uri } },
              { text: buildAnalysisPrompt(input.hint) },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini動画理解エラー (${res.status}): ${(await res.text()).slice(0, 400)}`);
    }
    const data = await res.json();
    const text = extractGeneratedText(data);
    if (!text) throw new Error("Gemini動画理解が空応答（モデルの動画対応を要確認）");
    return coercePattern(JSON.parse(text) as Partial<EditingPattern>);
  } finally {
    await deleteFile(apiKey, uploaded.name);
  }
}
