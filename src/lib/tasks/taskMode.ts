/**
 * 案件の作り方の見分け（支給素材の置き場所の頭の文字で決まる）。
 *   scene-raw/  … カット練習の案件。録ったままの声を受講者が切って仕上げる（scripts/scene/registerSceneTask.ts の RAW_STORAGE_PREFIX）
 *   scene-nisa/ … 以前の形。素材が［絆_素材を並べる］で自動で並ぶ
 *   それ以外    … 実案件など。依頼書を見ながら自分で並べる
 */
import type { TaskMaterial } from "@/lib/types";

export type TaskMode = "cut_practice" | "auto_arrange" | "manual";

export function taskModeOf(materials: Pick<TaskMaterial, "kind" | "media_url">[]): TaskMode {
  const assets = materials.find((m) => m.kind === "source_assets")?.media_url ?? "";
  if (assets.startsWith("scene-raw/")) return "cut_practice";
  if (assets.startsWith("scene-nisa/")) return "auto_arrange";
  return "manual";
}
