import { describe, expect, it } from "vitest";
import type { TaskMaterial } from "@/lib/types";
import {
  pickChecklistItems,
  pickDownloadableMaterials,
  pickInstructionSheet,
} from "./pickMaterials";

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

describe("pickDownloadableMaterials", () => {
  const assets = material({
    id: "assets",
    kind: "source_assets",
    title: "支給素材一式",
    media_url: "scene-nisa/assets.zip",
  });
  const sampleOpen = material({
    id: "sample-open",
    kind: "sample",
    title: "完成見本",
    media_url: "scene-nisa/sample.mp4",
    visible_before_submission: true,
  });
  const sampleStaffOnly = material({
    ...sampleOpen,
    id: "sample-staff",
    visible_before_submission: false,
  });

  it("支給素材は提出の有無に関係なく常に配布する", () => {
    expect(pickDownloadableMaterials([assets], false)).toEqual([assets]);
    expect(pickDownloadableMaterials([assets], true)).toEqual([assets]);
  });

  it("「提出前から公開」の完成見本は提出前でも見せる", () => {
    expect(pickDownloadableMaterials([sampleOpen, assets], false)).toEqual([
      sampleOpen,
      assets,
    ]);
  });

  it("「職員のみ」の完成見本は提出前は見せず、提出後に公開する", () => {
    expect(pickDownloadableMaterials([sampleStaffOnly, assets], false)).toEqual(
      [assets],
    );
    expect(pickDownloadableMaterials([sampleStaffOnly, assets], true)).toEqual([
      sampleStaffOnly,
      assets,
    ]);
  });

  it("ファイルの無い教材や、それ以外の種類は配布リストに入れない", () => {
    const noFile = material({ id: "nofile", kind: "sample", media_url: null });
    const doc = material({ id: "doc", kind: "request_doc", media_url: "x.pdf" });
    expect(pickDownloadableMaterials([noFile, doc, assets], true)).toEqual([
      assets,
    ]);
  });
});
