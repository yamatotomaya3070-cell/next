import Link from "next/link";
import { isWorkerSilent } from "@/lib/scene/stepFailure";
import { SCENE_JOB_STATUS_LABELS, type SceneJob } from "@/lib/types";

/** locked_by は「PC名:プロセス番号」。画面にはPC名だけ出す */
const pcName = (lockedBy: string | null) => lockedBy?.split(":")[0] ?? null;

const STATUS_TONE: Record<string, string> = {
  completed: "bg-success-soft text-success",
  failed: "bg-danger-soft text-danger",
  pending: "bg-page text-ink-soft",
};

export function SceneJobRow({
  job,
  sampleUrl,
  assetsUrl,
  now,
}: {
  job: SceneJob;
  sampleUrl?: string;
  assetsUrl?: string;
  /** 画面を作った時刻（作業PCから連絡が途絶えたかの判定に使う） */
  now: number;
}) {
  const tone = STATUS_TONE[job.status] ?? "bg-primary-soft text-primary";
  const isActive = job.status !== "completed" && job.status !== "failed" && job.status !== "pending";
  const pc = pcName(job.locked_by);
  // 処理中なのに作業PCから連絡が来ない＝PCの電源・スリープ・強制終了などで止まっている
  const isSilent = isActive && isWorkerSilent(job.locked_at, now);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-ink">{job.theme}</p>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${tone}`}>
          {SCENE_JOB_STATUS_LABELS[job.status]}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-page">
        <div
          className={`h-full rounded-full ${job.status === "failed" ? "bg-danger" : "bg-primary"}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {job.progress}% ／ 目安 約{job.target_minutes}分 ／ 難易度 {job.difficulty} ／{" "}
        {new Date(job.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        {pc && ` ／ 作業PC: ${pc}`}
        {isActive && !isSilent && "（処理中…）"}
      </p>

      {isSilent && (
        <p className="mt-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          作業PC（{pc}）から {new Date(job.locked_at!).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} を最後に連絡がありません。
          「{SCENE_JOB_STATUS_LABELS[job.status]}」の途中で、PCの電源が切れた・スリープした・処理が強制終了された可能性があります。
          作業PCの画面と、作業PCの記録ファイル（一時フォルダの kizuna-scene/scene-worker.log）を確かめてください。
        </p>
      )}

      {job.error && (
        <div className="mt-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <p className="font-bold">
            {job.error_stage ? `「${SCENE_JOB_STATUS_LABELS[job.error_stage]}」で止まりました` : "止まりました"}
          </p>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all font-sans">{job.error}</pre>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {job.task_id && (
          <Link href={`/staff/tasks/${job.task_id}`} className="font-bold text-primary hover:underline">
            登録された案件を見る →
          </Link>
        )}
        {sampleUrl && (
          <a href={sampleUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            完成見本
          </a>
        )}
        {assetsUrl && (
          <a href={assetsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            支給素材一式
          </a>
        )}
      </div>
    </div>
  );
}
