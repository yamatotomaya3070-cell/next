import Link from "next/link";
import { SCENE_JOB_STATUS_LABELS, type SceneJob } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  completed: "bg-success-soft text-success",
  failed: "bg-danger-soft text-danger",
  pending: "bg-page text-ink-soft",
};

export function SceneJobRow({
  job,
  sampleUrl,
  assetsUrl,
}: {
  job: SceneJob;
  sampleUrl?: string;
  assetsUrl?: string;
}) {
  const tone = STATUS_TONE[job.status] ?? "bg-primary-soft text-primary";
  const isActive = job.status !== "completed" && job.status !== "failed" && job.status !== "pending";

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
        {new Date(job.created_at).toLocaleString("ja-JP")}
        {isActive && "（処理中…）"}
      </p>

      {job.error && (
        <p className="mt-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">{job.error}</p>
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
