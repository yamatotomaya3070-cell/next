"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "./assignments";

/**
 * 実案件/参考動画の取り込み（docs/00011 方式C）。
 *
 * 大きい動画は Vercel のサーバーアクション・ボディ上限(~4.5MB)を超えるため、
 * ブラウザから Supabase Storage へ「署名付きアップロードURL」で直接アップロードし、
 * その後 registerVideoIngest で video_ingests 行を登録する（storage_path のみ受け取る）。
 * 解析はクラウド（Vercel Cron + Gemini Files API、src/lib/video/analysis/ingestProcessor.ts）が
 * 自動で拾って実行する。職員は /api/ingests/analyze で「今すぐ解析」も可能。
 * （旧経路の scripts/video/ingest-worker.ts はローカル/大容量向けのレガシーとして残置）
 */

const INGEST_BUCKET = "materials";

export interface IngestUploadUrl {
  error: string | null;
  path?: string;
  token?: string;
}

/** 署名付きアップロードURLを発行する（service roleで生成。原本は職員限定の materials に格納） */
export async function createIngestUploadUrl(filename: string): Promise<IngestUploadUrl> {
  await requireRole("staff", "admin");
  const ext = filename.includes(".") ? filename.split(".").pop() : "mp4";
  const path = `ingests/${randomUUID()}/source.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(INGEST_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "アップロードURLの発行に失敗しました。" };
  return { error: null, path, token: data.token };
}

export interface RegisterIngestInput {
  title: string;
  genreHint: string;
  storagePath: string;
  consent: boolean;
}

/** アップロード完了後、取り込み行を登録する（解析はワーカーが拾う） */
export async function registerVideoIngest(input: RegisterIngestInput): Promise<ActionState> {
  const staff = await requireRole("staff", "admin");
  const supabase = await createClient();

  const title = input.title.trim();
  if (!title) return { error: "タイトルを入力してください。" };
  if (!input.storagePath) return { error: "アップロードが完了していません。もう一度お試しください。" };

  const { error } = await supabase.from("video_ingests").insert({
    title,
    genre_hint: input.genreHint.trim() || null,
    source_kind: "reference",
    storage_path: input.storagePath,
    consent_status: input.consent ? "approved" : "pending",
    status: "pending",
    created_by: staff.id,
  });
  if (error) {
    return { error: "登録に失敗しました。migration 00012 が適用済みか確認してください。" };
  }

  revalidatePath("/staff/video-ingests");
  return { error: null, success: true };
}

/** 許諾状態を更新する（実案件動画の学習・配布は approved が前提） */
export async function setIngestConsent(
  id: string,
  status: "approved" | "rejected",
): Promise<ActionState> {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase.from("video_ingests").update({ consent_status: status }).eq("id", id);
  if (error) return { error: "許諾状態の更新に失敗しました。" };
  revalidatePath("/staff/video-ingests");
  return { error: null, success: true };
}
