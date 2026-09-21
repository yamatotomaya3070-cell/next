import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateAnswerData } from "@/lib/video/templates/types";

/**
 * 提出動画を「何と突き合わせるか」を案件から決める。
 *
 * - template: AI動画生成パイプライン(video_jobs)の正解データ表と比べる（旧経路）
 * - sample  : 完成見本の動画(task_materials kind=sample)を実測して比べる。
 *             支給素材ZIP(kind=source_assets)があれば、セリフ音声を使った構成照合もできる。
 *
 * 職員のみRLSのテーブルを読むため、呼び出し側は管理クライアント（service role）を渡す。
 */
export type InspectionTarget =
  | { kind: "template"; answerData: TemplateAnswerData }
  | {
      kind: "sample";
      /** materials バケット内の完成見本の相対パス */
      samplePath: string;
      /** materials バケット内の支給素材ZIPの相対パス（無ければ null） */
      assetsPath: string | null;
      /** 作業指示一覧（字幕の文の出どころ。task_materials revision_note「作業指示一覧」の本文。無ければ null） */
      instructionText: string | null;
    };

const INSTRUCTION_TITLE = "作業指示一覧";

export async function loadInspectionTarget(
  admin: SupabaseClient,
  taskId: string,
): Promise<InspectionTarget | null> {
  const { data: videoJob, error: vjErr } = await admin
    .from("video_jobs")
    .select("answer_data")
    .eq("task_id", taskId)
    .not("answer_data", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vjErr) throw new Error(`video_jobs の取得に失敗: ${vjErr.message}`);
  if (videoJob?.answer_data) {
    return { kind: "template", answerData: videoJob.answer_data as TemplateAnswerData };
  }

  const { data: materials, error: mErr } = await admin
    .from("task_materials")
    .select("kind, title, content, media_url, sort_order")
    .eq("task_id", taskId)
    .in("kind", ["sample", "source_assets", "revision_note"])
    .eq("is_approved", true) // 職員が確認済みの見本だけを「正解」にする（差し替え中の下書きを使わない）
    .order("sort_order", { ascending: true });
  if (mErr) throw new Error(`task_materials の取得に失敗: ${mErr.message}`);

  const rows = (materials ?? []) as Array<{
    kind: string;
    title: string | null;
    content: string | null;
    media_url: string | null;
  }>;
  const sample = rows.find((m) => m.kind === "sample" && m.media_url);
  if (!sample?.media_url) return null;
  const assets = rows.find((m) => m.kind === "source_assets" && m.media_url);
  const instruction = rows.find((m) => m.kind === "revision_note" && m.title === INSTRUCTION_TITLE && m.content);
  return {
    kind: "sample",
    samplePath: sample.media_url,
    assetsPath: assets?.media_url ?? null,
    instructionText: instruction?.content ?? null,
  };
}

/** 提出時に検品ジョブを登録すべき案件か（見本か正解データのどちらかがある） */
export async function isInspectableTask(admin: SupabaseClient, taskId: string): Promise<boolean> {
  return (await loadInspectionTarget(admin, taskId)) !== null;
}
