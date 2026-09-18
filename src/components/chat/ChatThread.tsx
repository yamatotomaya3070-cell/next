"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, MessageSenderKind } from "@/lib/types";
import { markMessagesRead, sendMessage } from "@/lib/actions/messages";
import { groupMessagesByDay } from "@/lib/messages/format";
import { ChatComposer, type ComposerTaskOption } from "./ChatComposer";
import { DateDivider } from "./DateDivider";
import { MessageBubble } from "./MessageBubble";
import { useLiveMessages } from "./useLiveMessages";

interface ChatThreadProps {
  traineeId: string;
  /** 見ている人の種別。自分の発言を右側に出す判定に使う */
  viewerKind: Extract<MessageSenderKind, "trainee" | "staff">;
  viewerName: string;
  initialMessages: ChatMessage[];
  assignmentTitles: Record<string, string>;
  taskOptions?: ComposerTaskOption[];
  /** メッセージが1件も無いときの案内 */
  emptyHint: string;
  /** false のときは通信せず、送信もローカルに積むだけ（開発プレビュー用） */
  live?: boolean;
}

/** 「一番下から」この距離以内に居れば、新着時に自動で最下部へ追従する */
const NEAR_BOTTOM_PX = 120;

function isFromOtherSide(
  message: ChatMessage,
  viewerKind: ChatThreadProps["viewerKind"],
): boolean {
  return viewerKind === "trainee"
    ? message.sender_kind !== "trainee"
    : message.sender_kind === "trainee";
}

/** LINE風トーク画面（吹き出し一覧＋入力欄）。ページ側で高さを決めた枠の中に置く */
export function ChatThread({
  traineeId,
  viewerKind,
  viewerName,
  initialMessages,
  assignmentTitles,
  taskOptions,
  emptyHint,
  live = true,
}: ChatThreadProps) {
  const { messages, append, markReadLocally, syncError } = useLiveMessages({
    traineeId,
    initialMessages,
    live,
  });
  const [isPending, setIsPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickRef = useRef(true);

  // 相手からの未読を既読にする（画面が見えているときだけ）
  const unreadIds = messages
    .filter((m) => isFromOtherSide(m, viewerKind) && !m.read_at)
    .map((m) => m.id);
  const unreadKey = unreadIds.join(",");
  useEffect(() => {
    if (!live || unreadIds.length === 0) return;
    if (document.visibilityState !== "visible") return;
    let cancelled = false;
    void markMessagesRead(traineeId).then((res) => {
      if (!cancelled && res.readAt) markReadLocally(unreadIds, res.readAt);
    });
    return () => {
      cancelled = true;
    };
    // unreadIds は unreadKey と同期しているため、キーで発火させる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadKey, traineeId, live]);

  // 新着時は、下の方を見ていたときだけ最下部へ追従する
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    shouldStickRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && shouldStickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async (
    body: string,
    assignmentId: string | null,
  ): Promise<boolean> => {
    setSendError(null);
    if (!live) {
      append(previewMessage(traineeId, viewerKind, viewerName, body, assignmentId));
      shouldStickRef.current = true;
      return true;
    }
    setIsPending(true);
    try {
      const res = await sendMessage({ traineeId, body, assignmentId });
      if (res.error || !res.message) {
        setSendError(res.error ?? "送信に失敗しました。");
        return false;
      }
      shouldStickRef.current = true;
      append(res.message);
      return true;
    } finally {
      setIsPending(false);
    }
  };

  const groups = groupMessagesByDay(messages);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-chat px-3 py-3 md:px-6"
        role="log"
        aria-live="polite"
        aria-label="メッセージのやりとり"
      >
        {syncError && (
          <p
            role="alert"
            className="mx-auto mb-3 max-w-md rounded-xl bg-danger-soft px-3 py-2 text-center text-xs font-bold text-danger"
          >
            {syncError}
          </p>
        )}

        {groups.length === 0 ? (
          <p className="mx-auto mt-10 max-w-sm rounded-2xl bg-surface/80 px-5 py-4 text-center text-sm leading-relaxed text-ink-soft">
            {emptyHint}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <DateDivider label={group.label} />
              {group.messages.map((m, i) => {
                const prev = group.messages[i - 1];
                // 自分と同じ立場（利用者／職員）の発言だけ右側。AIの発言は職員から見ても左側に出す
                const isOwn = m.sender_kind === viewerKind;
                const isContinuation =
                  !!prev &&
                  prev.sender_kind === m.sender_kind &&
                  prev.sender_id === m.sender_id;
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isOwn={isOwn}
                    isContinuation={isContinuation}
                    assignmentTitle={
                      m.assignment_id
                        ? (assignmentTitles[m.assignment_id] ?? null)
                        : null
                    }
                  />
                );
              })}
            </div>
          ))
        )}
      </div>

      <ChatComposer
        onSend={handleSend}
        isPending={isPending}
        error={sendError}
        taskOptions={taskOptions}
      />
    </div>
  );
}

/** プレビュー用: サーバーに送らず、その場で吹き出しを作る */
function previewMessage(
  traineeId: string,
  viewerKind: ChatThreadProps["viewerKind"],
  viewerName: string,
  body: string,
  assignmentId: string | null,
): ChatMessage {
  return {
    id: `preview-${Date.now()}`,
    trainee_id: traineeId,
    sender_id: viewerKind === "trainee" ? traineeId : "preview-staff",
    sender_kind: viewerKind,
    sender_name: viewerName,
    assignment_id: assignmentId,
    body: body.trim(),
    read_at: null,
    created_at: new Date().toISOString(),
  };
}
