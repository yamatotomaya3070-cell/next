import type { ChatMessage } from "@/lib/types";
import { formatMessageTime } from "@/lib/messages/format";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconRobot } from "@/components/ui/icons";

interface MessageBubbleProps {
  message: ChatMessage;
  /** 自分の発言なら右側・青、相手なら左側・白 */
  isOwn: boolean;
  /** 直前が同じ人の発言なら、アバターと名前を省いて詰める */
  isContinuation: boolean;
  assignmentTitle: string | null;
}

/** LINE風の吹き出し1つ分 */
export function MessageBubble({
  message,
  isOwn,
  isContinuation,
  assignmentTitle,
}: MessageBubbleProps) {
  const time = formatMessageTime(message.created_at);
  const isAi = message.sender_kind === "ai";

  return (
    <div
      className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""} ${
        isContinuation ? "mt-1" : "mt-3"
      }`}
    >
      {/* 相手側のアバター（連続発言では位置だけ空ける） */}
      {!isOwn && (
        <div className="w-8 shrink-0 self-start">
          {!isContinuation &&
            (isAi ? (
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-full bg-teal-soft text-teal"
              >
                <IconRobot className="size-4" />
              </span>
            ) : (
              <UserAvatar name={message.sender_name} size="sm" />
            ))}
        </div>
      )}

      <div
        className={`flex max-w-[78%] flex-col md:max-w-[60%] ${
          isOwn ? "items-end" : "items-start"
        }`}
      >
        {!isOwn && !isContinuation && (
          <span className="mb-0.5 ml-1 text-xs font-bold text-ink-soft">
            {message.sender_name}
          </span>
        )}

        <div className={`flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
          <div
            className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-card ${
              isOwn
                ? "rounded-tr-sm bg-primary text-white"
                : "rounded-tl-sm bg-surface text-ink"
            }`}
          >
            {assignmentTitle && (
              <span
                className={`mb-1 block w-fit rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                  isOwn
                    ? "bg-white/20 text-white"
                    : "bg-primary-soft text-primary-dark"
                }`}
              >
                案件: {assignmentTitle}
              </span>
            )}
            {message.body}
          </div>

          {/* 時刻と既読（LINE同様、吹き出しの脇に小さく） */}
          <div
            className={`flex shrink-0 flex-col text-[10px] leading-tight text-ink-soft ${
              isOwn ? "items-end" : "items-start"
            }`}
          >
            {isOwn && message.read_at && <span>既読</span>}
            <time dateTime={message.created_at}>{time}</time>
          </div>
        </div>
      </div>
    </div>
  );
}
