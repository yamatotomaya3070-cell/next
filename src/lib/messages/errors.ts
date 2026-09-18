/** messages テーブルまわりのエラーを、画面で説明できる文言に変換する */

export const MESSAGES_TABLE_MISSING_HINT =
  "メッセージ機能の準備ができていません（migration 00020_messages.sql が未適用の可能性があります）。";

/** PostgREST の「テーブルが無い」(42P01) は、適用漏れの案内にする */
export function describeMessagesError(err: {
  code?: string;
  message?: string;
} | null): string {
  if (err?.code === "42P01" || err?.message?.includes("messages")) {
    return MESSAGES_TABLE_MISSING_HINT;
  }
  return "メッセージの読み書きに失敗しました。時間をおいて再度お試しください。";
}
