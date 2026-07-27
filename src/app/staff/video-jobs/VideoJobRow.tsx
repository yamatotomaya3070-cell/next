"use client";

import { useActionState, useState } from "react";
import { retryVideoJob, updateVideoJobScript } from "@/lib/actions/videoJobs";
import type { ActionState } from "@/lib/actions/assignments";
import { VIDEO_JOB_STATUS_LABELS, type VideoJob, type VideoJobEvent } from "@/lib/types";
import { TEMPLATE_REGISTRY, type AnyVideoScript } from "@/lib/video/templates";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";

const STAGE_TONE: Record<VideoJob["status"], BadgeTone> = {
  pending: "neutral",
  generating_script: "info",
  generating_voice: "info",
  generating_assets: "info",
  generating_subtitles: "info",
  rendering_preview: "info",
  packaging_assets: "info",
  registering_task: "info",
  completed: "success",
  failed: "danger",
};

const initialSaveState: ActionState = { error: null };

function ScriptEditor({ job }: { job: VideoJob }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateVideoJobScript, initialSaveState);
  const script = job.script as AnyVideoScript | null;

  if (!script) {
    return <p className="text-sm text-ink-soft">台本はまだ生成されていません。</p>;
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink">
          「{script.title}」（{script.scenes?.length ?? 0}シーン）
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={job.status === "completed"}
          className="text-sm font-bold text-primary hover:underline disabled:opacity-40"
        >
          台本を確認・修正する
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="job_id" value={job.id} />
      <textarea
        name="script_json"
        rows={16}
        defaultValue={JSON.stringify(script, null, 2)}
        className="w-full rounded-xl border-2 border-line p-3 font-mono text-xs focus:border-primary focus:outline-none"
      />
      <p className="text-xs text-ink-soft">
        保存すると、この台本の内容でワーカーが音声・字幕・完成見本を作り直します（既存の生成物は破棄されます）。
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {isPending ? "保存しています…" : "保存して再生成する"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold text-ink-soft hover:bg-page"
        >
          閉じる
        </button>
      </div>
    </form>
  );
}

export function VideoJobRow({
  job,
  events,
  videoUrl,
  zipUrl,
  rawTakeUrl,
}: {
  job: VideoJob;
  events: VideoJobEvent[];
  videoUrl: string | null;
  zipUrl: string | null;
  rawTakeUrl: string | null;
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    const result = await retryVideoJob(job.id);
    if (result.error) setRetryError(result.error);
    setRetrying(false);
  };

  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-ink">{job.theme}</p>
          <p className="text-sm text-ink-soft">
            {TEMPLATE_REGISTRY[job.template_type]?.label ?? job.template_type} / レベル{job.difficulty} / 目標
            {job.target_duration_sec}秒
            {job.provider && ` / ${job.provider}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={VIDEO_JOB_STATUS_LABELS[job.status]} tone={STAGE_TONE[job.status]} size="sm" />
          <span className="text-sm text-ink-soft">{job.progress}%</span>
        </div>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-page">
        <div
          className={`h-full rounded-full ${job.status === "failed" ? "bg-danger" : "bg-primary"}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {job.status === "failed" && job.error && (
        <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-ink">
          <p className="font-bold text-danger">
            工程「{job.error_stage ? VIDEO_JOB_STATUS_LABELS[job.error_stage] : "不明"}」で失敗（{job.retry_count}回目）
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{job.error}</p>
          {retryError && <p className="mt-1 font-bold text-danger">{retryError}</p>}
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="mt-2 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {retrying ? "再実行を登録中…" : "この工程から再実行する"}
          </button>
        </div>
      )}

      <div className="mt-3">
        <ScriptEditor job={job} />
      </div>

      {(videoUrl || zipUrl) && (
        <div className="mt-3 space-y-2">
          {videoUrl && (
            <video controls className="w-full max-w-md rounded-xl border border-line" src={videoUrl} />
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            {videoUrl && (
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
                完成見本を新しいタブで開く
              </a>
            )}
            {zipUrl && (
              <a href={zipUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
                支給素材ZIPをダウンロード
              </a>
            )}
            {rawTakeUrl && (
              <a href={rawTakeUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
                未編集の対談音声（連続収録）を開く
              </a>
            )}
          </div>
        </div>
      )}

      {job.task_id && (
        <a
          href={`/staff/tasks/${job.task_id}`}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-bold text-primary hover:bg-primary-soft"
        >
          登録された案件を見る →
        </a>
      )}

      {events.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold text-ink-soft">工程ログ（{events.length}件）</summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-soft">
            {events.map((e) => (
              <li key={e.id}>
                {new Date(e.created_at).toLocaleString("ja-JP")} - {VIDEO_JOB_STATUS_LABELS[e.stage]} -{" "}
                {e.event}
                {e.duration_ms ? `（${Math.round(e.duration_ms / 1000)}秒）` : ""}
                {e.detail ? `: ${e.detail.slice(0, 120)}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
