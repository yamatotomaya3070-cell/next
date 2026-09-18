import type { SelfCheckItem } from "@/lib/types";

/**
 * 提出フォームから送られてくる self_check（JSON文字列）を検証して取り込む。
 *
 * 画面側のJSONをそのまま信用すると、想定外の構造が submissions.self_check に
 * 保存され、自動差し戻しの判定や職員のレビュー画面が壊れる。
 * 形の合わない要素は捨てる（フォームの改ざんで落ちないようにするため、
 * 例外は投げずに安全側へ倒す）。
 */
export function parseSelfCheck(raw: string): SelfCheckItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry): SelfCheckItem[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { item, checked } = entry as { item?: unknown; checked?: unknown };
    if (typeof item !== "string" || typeof checked !== "boolean") return [];
    const trimmed = item.trim();
    if (!trimmed) return [];
    return [{ item: trimmed, checked }];
  });
}
