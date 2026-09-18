import { describe, expect, it } from "vitest";
import type { TaskMaterial } from "@/lib/types";
import { pickChecklistItems, pickInstructionSheet } from "./pickMaterials";

function material(partial: Partial<TaskMaterial>): TaskMaterial {
  return {
    id: partial.id ?? "m",
    task_id: "t",
    kind: "revision_note",
    title: "",
    content: null,
    steps: null,
    media_url: null,
    sort_order: 0,
    generated_by: "staff",
    is_approved: true,
    visible_before_submission: true,
    created_at: "2026-09-18T00:00:00Z",
    ...partial,
  };
}

// 本番の案件と同じ並び：編集指示書（表）が先、納品前チェックリスト（JSON）が後
const instructionSheet = material({
  id: "sheet",
  title: "編集指示書（タイムライン）",
  sort_order: 2,
  content: "## 編集指示書\n\n| 順番 | 演者 |\n|---|---|\n| 1-1 | ナレーション |",
});
const checklist = material({
  id: "check",
  title: "納品前チェックリスト",
  sort_order: 9,
  content: JSON.stringify(["字幕が全部ある", "1280x720 で書き出した"]),
});

describe("pickChecklistItems", () => {
  it("編集指示書が先に並んでいても、納品前チェックリストの項目を返す", () => {
    expect(pickChecklistItems([instructionSheet, checklist])).toEqual([
      "字幕が全部ある",
      "1280x720 で書き出した",
    ]);
  });

  it("チェックリストが無い案件では、共通の3項目を返す", () => {
    expect(pickChecklistItems([instructionSheet])).toEqual([
      "依頼書のとおりに作業した",
      "最初から最後まで見直した",
      "指定されたファイル形式で書き出した",
    ]);
  });

  it("表の行をチェック項目として読み込まない", () => {
    const items = pickChecklistItems([instructionSheet]);
    expect(items.some((i) => i.includes("|"))).toBe(false);
  });
});

describe("pickInstructionSheet", () => {
  it("表の入った指示書を返し、チェックリストは返さない", () => {
    expect(pickInstructionSheet([checklist, instructionSheet])?.id).toBe("sheet");
  });

  it("指示書が無ければ null", () => {
    expect(pickInstructionSheet([checklist])).toBeNull();
  });
});
