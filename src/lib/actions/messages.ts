"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, createClient } from "@/lib/supabase/server";
import { describeMessagesError } from "@/lib/messages/errors";
import type { ChatMessage, MessageSenderKind, Profile } from "@/lib/types";

/** 1発言の上限文字数（長文は分けて送ってもらう） */
const MAX_BODY_LENGTH = 2000;
/** 差分取得で一度に返す最大件数 */
const FETCH_LIMIT = 50;

export interface SendMessageResult {
  error: string | null;
  message?: ChatMessage;
}

export interface FetchMessagesResult {
  error: string | null;
  messages: ChatMessage[];
}

function senderKindOf(profile: Profile): MessageSenderKind {
  return profile.role === "trainee" ? "trainee" : "staff";
}

/**
 * 操作できるトークか確認する。
 * 利用者は自分のトークだけ、職員はどのトークでも可。
 */
function canAccessRoom(profile: Profile, traineeId: string): boolean {
  if (profile.role === "trainee") return traineeId === profile.id;
  return /^[0-9a-f-]{36}$/i.test(traineeId);
}

/** メッセージを送る（利用者・職員のどちらからでも） */
export async function sendMessage(input: {
  traineeId: string;
  body: string;
  assignmentId?: string | null;
}): Promise<SendMessageResult> {
  const profile = await requireProfile();
  if (!canAccessRoom(profile, input.traineeId)) {
    return { error: "このトークには送信できません。" };
  }

  const body = input.body.trim();
  if (!body) return { error: "メッセージを入力してください。" };
  if (body.length > MAX_BODY_LENGTH) {
    return {
      error: `メッセージが長すぎます（${MAX_BODY_LENGTH}文字まで）。分けて送ってください。`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      trainee_id: input.traineeId,
      sender_id: profile.id,
      sender_kind: senderKindOf(profile),
      sender_name: profile.display_name,
      assignment_id: input.assignmentId || null,
      body,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("メッセージの送信に失敗:", error);
    return { error: describeMessagesError(error) };
  }

  // 案件に紐づく質問は、案件の進行記録にも「相談」として残す（旧フォーム互換）
  if (profile.role === "trainee" && input.assignmentId) {
    await supabase.from("progress_logs").insert({
      assignment_id: input.assignmentId,
      user_id: profile.id,
      event: "consult",
      note: body.slice(0, 100),
    });
    revalidatePath(`/tasks/${input.assignmentId}`);
  }

  revalidatePath("/messages");
  revalidatePath("/staff/messages");
  revalidatePath("/staff");
  return { error: null, message: data as ChatMessage };
}

/**
 * トークの最新メッセージを取得する（ポーリング用）。
 * 既読状態の変化も拾えるよう、差分ではなく「最新 N 件」を返す。
 */
export async function fetchLatestMessages(
  traineeId: string,
): Promise<FetchMessagesResult> {
  const profile = await requireProfile();
  if (!canAccessRoom(profile, traineeId)) {
    return { error: "このトークは閲覧できません。", messages: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("trainee_id", traineeId)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    return { error: describeMessagesError(error), messages: [] };
  }
  return { error: null, messages: (data ?? []).reverse() as ChatMessage[] };
}

/** 相手からの未読メッセージを既読にする（自分の種別以外の発言が対象） */
export async function markMessagesRead(
  traineeId: string,
): Promise<{ error: string | null; readAt: string | null }> {
  const profile = await requireProfile();
  if (!canAccessRoom(profile, traineeId)) {
    return { error: "このトークは閲覧できません。", readAt: null };
  }

  const supabase = await createClient();
  const readAt = new Date().toISOString();
  const query = supabase
    .from("messages")
    .update({ read_at: readAt })
    .eq("trainee_id", traineeId)
    .is("read_at", null);
  const { error } =
    profile.role === "trainee"
      ? await query.in("sender_kind", ["staff", "ai"])
      : await query.eq("sender_kind", "trainee");

  if (error) {
    return { error: describeMessagesError(error), readAt: null };
  }
  revalidatePath("/staff/messages");
  revalidatePath("/staff");
  return { error: null, readAt };
}
