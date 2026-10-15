"use client";

// 提出動画を Storage に送り、送れた割合を知らせる。
// supabase-js の upload() は進み具合を返さないため、大きな動画だと何分も画面が変わらず
// 「止まった」と思われて押し直される。Storage の REST に XMLHttpRequest で直接送って進み具合を出す。
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

export interface UploadFailure {
  message: string;
  statusCode?: number;
}

/** 送れた割合 0〜100 を onProgress に渡す。失敗は UploadFailure を投げる（describeUploadError で文にできる） */
export async function uploadWithProgress(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { url, anonKey } = getSupabaseEnv();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw { message: "unauthorized", statusCode: 401 } satisfies UploadFailure;

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${url}/storage/v1/object/${bucket}/${encodedPath}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = xhr.statusText || `HTTP ${xhr.status}`;
      try {
        message = (JSON.parse(xhr.responseText) as { message?: string }).message ?? message;
      } catch {
        // 本文が JSON でなければ statusText のまま
      }
      reject({ message, statusCode: xhr.status } satisfies UploadFailure);
    };
    xhr.onerror = () => reject(new TypeError("network error"));
    xhr.ontimeout = () => reject(new TypeError("timeout"));
    xhr.send(file);
  });
}
