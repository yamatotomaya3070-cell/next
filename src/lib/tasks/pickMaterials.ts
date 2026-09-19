import type { TaskMaterial } from "@/lib/types";

// 案件の revision_note には「作業指示一覧（表）」と「納品前チェックリスト（JSON）」の
// 2種類がある。並び順は案件によって違うので、中身の形で見分ける。

const DEFAULT_CHECKLIST = [
  "依頼書のとおりに作業した",
  "最初から最後まで見直した",
  "指定されたファイル形式で書き出した",
];

function parseStringArray(content: string | null): string[] | null {
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) return null;
    const items = parsed.map(String).map((s) => s.trim()).filter(Boolean);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

const hasTable = (content: string | null) =>
  !!content && /^\s*\|.*\|\s*$/m.test(content);

/** 提出前の自己チェック項目。チェックリストが無い案件は共通の3項目 */
export function pickChecklistItems(materials: TaskMaterial[]): string[] {
  for (const m of materials) {
    if (m.kind !== "revision_note") continue;
    const items = parseStringArray(m.content);
    if (items) return items;
  }
  return DEFAULT_CHECKLIST;
}

/** 字幕の文字などをコピーする元の「作業指示一覧」。無ければ null */
export function pickInstructionSheet(
  materials: TaskMaterial[],
): TaskMaterial | null {
  return (
    materials.find(
      (m) =>
        m.kind === "revision_note" &&
        !parseStringArray(m.content) &&
        hasTable(m.content),
    ) ?? null
  );
}

/**
 * 利用者に配布するファイル（署名付きURLを発行する対象）。
 * - 支給素材(source_assets)は常に配布する
 * - 完成見本(sample)は職員の設定に従う:
 *     visible_before_submission=true  → 提出前から見せる
 *     visible_before_submission=false → 職員のみ（利用者には提出後に公開）
 */
export function pickDownloadableMaterials(
  materials: TaskMaterial[],
  hasSubmitted: boolean,
): TaskMaterial[] {
  return materials.filter((m) => {
    if (!m.media_url) return false;
    if (m.kind === "source_assets") return true;
    if (m.kind !== "sample") return false;
    return m.visible_before_submission || hasSubmitted;
  });
}
