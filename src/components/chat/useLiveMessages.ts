"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchLatestMessages } from "@/lib/actions/messages";
import { mergeMessages } from "@/lib/messages/format";
import type { ChatMessage } from "@/lib/types";

/** Realtime が届かない環境でも新着が拾えるように、この間隔で取り直す */
const POLL_INTERVAL_MS = 8000;

interface UseLiveMessagesOptions {
  traineeId: string;
  initialMessages: ChatMessage[];
  /** false のときは通信しない（開発用プレビュー） */
  live: boolean;
}

/**
 * トークのメッセージ一覧を「Realtime ＋ ポーリング」で最新に保つ。
 * サーバーから渡された初期一覧に、届いた分をIDで重ね合わせる。
 */
export function useLiveMessages({
  traineeId,
  initialMessages,
  live,
}: UseLiveMessagesOptions) {
  const [messages, setMessages] = useState(initialMessages);
  const [syncError, setSyncError] = useState<string | null>(null);

  // サーバー側が再描画されたとき（router.refresh 等）は、既存分に重ねる。
  // （effect ではなく描画中に state を合わせる React 推奨パターン）
  const [seenInitial, setSeenInitial] = useState(initialMessages);
  if (seenInitial !== initialMessages) {
    setSeenInitial(initialMessages);
    setMessages((prev) => mergeMessages(prev, initialMessages));
  }

  // Realtime: 同じトークへの INSERT / UPDATE（既読）を即時反映
  useEffect(() => {
    if (!live) return;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const channel = supabase
      .channel(`messages-${traineeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `trainee_id=eq.${traineeId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as ChatMessage;
          if (!row?.id) return;
          setMessages((prev) => mergeMessages(prev, [row]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [traineeId, live]);

  // ポーリング: 画面が見えているときだけ最新N件を取り直す
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetchLatestMessages(traineeId);
      if (cancelled) return;
      if (res.error) {
        setSyncError(res.error);
        return;
      }
      setSyncError(null);
      setMessages((prev) => mergeMessages(prev, res.messages));
    };
    const id = setInterval(() => void tick(), POLL_INTERVAL_MS);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [traineeId, live]);

  const append = useCallback((message: ChatMessage) => {
    setMessages((prev) => mergeMessages(prev, [message]));
  }, []);

  const markReadLocally = useCallback((ids: string[], readAt: string) => {
    const target = new Set(ids);
    setMessages((prev) =>
      prev.map((m) => (target.has(m.id) ? { ...m, read_at: readAt } : m)),
    );
  }, []);

  return { messages, append, markReadLocally, syncError };
}
