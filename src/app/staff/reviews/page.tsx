import { requireRole, createClient } from "@/lib/supabase/server";
import type {
  CheckItem,
  Feedback,
  SelfCheckItem,
  SubmissionInspection,
} from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  IconCheckCircle,
  IconCheckSquare,
  IconFileText,
  IconRobot,
  IconVideo,
} from "@/components/ui/icons";
import {
  activeFeedback,
  latestSubmissionPerAssignment,
  reviewStateOf,
  type ReviewState,
} from "@/lib/review/reviewState";
import { ReviewForm } from "./ReviewForm";
import { RunAiReviewForm } from "./RunAiReviewForm";

export const dynamic = "force-dynamic";

interface SubmissionRow {
  id: string;
  file_name: string | null;
  file_path: string | null;
  note: string | null;
  work_minutes: number | null;
  self_check: SelfCheckItem[] | null;
  version: number;
  assignment_id: string;
  submitted_at: string;
  task_assignments: {
    id: string;
    user_id: string;
    profiles: { display_name: string } | null;
    tasks: { title: string } | null;
  } | null;
  feedback: Feedback[] | null;
  submission_inspections: SubmissionInspection | null;
}

const REVIEW_STATE_BADGE: Record<ReviewState, { label: string; tone: BadgeTone }> = {
  not_reviewed: { label: "AIレビュー未実施", tone: "danger" },
  draft_pending: { label: "AI下書き・承認待ち", tone: "warning" },
  auto_returned: { label: "AIが自動で差し戻し済み・職員未確認", tone: "purple" },
};

const CHECK_STATUS_BADGE: Record<CheckItem["status"], { label: string; tone: BadgeTone }> = {
  pass: { label: "OK", tone: "success" },
  fail: { label: "NG", tone: "danger" },
  unknown: { label: "不明", tone: "neutral" },
};

export default async function ReviewsPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  // 提出物を起点にする。AIレビューの下書きが作られなかった提出物も
  // 必ずここに並ぶようにして、職員の導線が消えないようにする。
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `id, file_name, file_path, note, work_minutes, self_check, version, assignment_id, submitted_at,
        task_assignments(id, user_id, profiles!task_assignments_user_id_fkey(display_name), tasks(title)),
        feedback(*),
        submission_inspections(status, check_result, probe_result)`,
    )
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const allSubmissions = (data ?? []) as unknown as SubmissionRow[];

  // 同じ案件で再提出された場合、古いバージョンはレビュー対象から外す
  const targets = latestSubmissionPerAssignment(allSubmissions)
    .map((sub) => {
      const feedbacks = [...(sub.feedback ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      return { sub, feedbacks, state: reviewStateOf(feedbacks) };
    })
    .filter((row): row is { sub: SubmissionRow; feedbacks: Feedback[]; state: ReviewState } =>
      row.state !== null,
    )
    .sort((a, b) => a.sub.submitted_at.localeCompare(b.sub.submitted_at));

  // 提出動画は private バケット 'submissions' 内の相対パス。都度署名付きURLを発行する
  const videoUrls = await Promise.all(
    targets.map(async ({ sub }) => {
      if (!sub.file_path) return null;
      const { data: signed } = await supabase.storage
        .from("submissions")
        .createSignedUrl(sub.file_path, 60 * 60);
      return signed?.signedUrl ?? null;
    }),
  );

  return (
    <PageContainer>
      <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
        <IconCheckSquare className="text-primary" />
        提出レビュー
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        提出された動画を見て、「合格」か「差し戻し（やり直し）」を決めてください。
        AIが明らかな間違いを見つけた提出は、先に自動で差し戻してあります。
      </p>

      {targets.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconCheckCircle />}
            title="対応が必要な提出はありません"
            description="新しい提出があると、AIレビューの下書きと一緒にここに表示されます。"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {targets.map(({ sub, feedbacks, state }, index) => {
            const assignment = sub.task_assignments;
            const userName = assignment?.profiles?.display_name ?? "不明な利用者";
            const videoUrl = videoUrls[index];
            const inspection = sub.submission_inspections ?? null;
            const feedback = activeFeedback(feedbacks);
            const stateBadge = REVIEW_STATE_BADGE[state];

            return (
              <SectionCard key={sub.id}>
                <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
                  <UserAvatar name={userName} size="sm" />
                  <span className="font-bold text-ink">{userName} さん</span>
                  <span className="text-ink-soft">{assignment?.tasks?.title}</span>
                  <StatusBadge label={`提出 ${sub.version}回目`} tone="neutral" size="sm" />
                  {sub.work_minutes != null && (
                    <StatusBadge label={`作業 ${sub.work_minutes}分`} tone="neutral" size="sm" />
                  )}
                  <StatusBadge label={stateBadge.label} tone={stateBadge.tone} size="sm" />
                </div>

                {videoUrl ? (
                  <div className="mt-4">
                    <video
                      controls
                      preload="metadata"
                      className="w-full max-w-md rounded-xl border border-line"
                      src={videoUrl}
                    />
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger">
                    提出ファイルが見つかりません。利用者に再提出をお願いしてください。
                  </p>
                )}

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div className="text-sm">
                    <p className="flex items-center gap-1.5 font-bold text-ink-soft">
                      <IconFileText className="size-4" />
                      提出情報
                    </p>
                    <p className="mt-2 font-medium text-ink">
                      {sub.file_name ?? "ファイルなし"}
                    </p>
                    {sub.note && (
                      <p className="mt-2 rounded-xl bg-page p-3 leading-relaxed text-ink">
                        {sub.note}
                      </p>
                    )}
                    {sub.self_check && sub.self_check.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {sub.self_check.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              aria-hidden
                              className={c.checked ? "text-success" : "text-danger"}
                            >
                              {c.checked ? "✓" : "－"}
                            </span>
                            <span className={c.checked ? "text-ink" : "text-danger"}>
                              {c.item}
                              {!c.checked && "（未チェック）"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="text-sm">
                    <p className="flex items-center gap-1.5 font-bold text-ink-soft">
                      <IconRobot className="size-4" />
                      AIレビュー
                      {feedback?.score != null && <span>（スコア {feedback.score} 点）</span>}
                    </p>

                    {state === "not_reviewed" ? (
                      <div className="mt-2 rounded-xl bg-danger-soft p-3">
                        <p className="font-bold text-danger">
                          この提出にはAIレビューがありません。
                        </p>
                        <p className="mt-1 text-ink">
                          提出時にAIレビューの作成に失敗した提出です。下のボタンで実行できます。
                          実行しなくても、動画を見て合格・差し戻しを決められます。
                        </p>
                        <div className="mt-3">
                          <RunAiReviewForm submissionId={sub.id} />
                        </div>
                      </div>
                    ) : (
                      <>
                        {state === "auto_returned" && (
                          <p className="mt-2 rounded-xl bg-accent-purple-soft p-3 font-bold text-accent-purple">
                            AIが利用者へ自動で差し戻しました。内容を確認してください。
                          </p>
                        )}
                        {feedback?.summary && (
                          <p className="mt-2 rounded-xl bg-page p-3 leading-relaxed text-ink">
                            {feedback.summary}
                          </p>
                        )}
                        {feedback?.good_points && feedback.good_points.length > 0 && (
                          <div className="mt-2 rounded-xl bg-success-soft p-3">
                            <p className="text-xs font-bold text-success">良かった点</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                              {feedback.good_points.map((p) => (
                                <li key={p}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {feedback?.improve_points && feedback.improve_points.length > 0 && (
                          <div className="mt-2 rounded-xl bg-warning-soft p-3">
                            <p className="text-xs font-bold text-amber-700">
                              直してほしいこと
                            </p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                              {feedback.improve_points.map((p) => (
                                <li key={p}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="mt-3">
                          <RunAiReviewForm submissionId={sub.id} label="AIレビューをやり直す" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-line pt-4 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-ink-soft">
                    <IconVideo className="size-4" />
                    見本との自動照合（機械検品）
                    {inspection?.status === "completed" && inspection.check_result && (
                      <StatusBadge
                        label={`自動採点 ${inspection.check_result.autoScore}点`}
                        tone="info"
                        size="sm"
                      />
                    )}
                  </p>
                  {!inspection ? (
                    <p className="mt-2 text-ink-soft">
                      この案件は見本の正解データが登録されていないため、自動照合は行われません。
                      動画を見て判断してください。
                    </p>
                  ) : inspection.status !== "completed" ? (
                    <p className="mt-2 text-ink-soft">
                      {inspection.status === "failed"
                        ? "照合に失敗しました。動画を見て判断してください。"
                        : "照合の順番待ちです。動画を見て判断して構いません。"}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {inspection.check_result?.checks.map((c) => {
                        const badge = CHECK_STATUS_BADGE[c.status];
                        return (
                          <li key={c.key} className="flex flex-wrap items-center gap-2">
                            <StatusBadge label={badge.label} tone={badge.tone} size="sm" />
                            <span className="font-medium text-ink">{c.label}</span>
                            <span className="text-ink-soft">
                              実測: {c.actual} / 見本: {c.expected}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <ReviewForm
                    feedbackId={feedback?.id ?? null}
                    submissionId={sub.id}
                    assignmentId={sub.assignment_id}
                    defaultScore={feedback?.score ?? 70}
                    defaultSummary={feedback?.summary ?? ""}
                    defaultImprovePoints={feedback?.improve_points ?? []}
                    autoReturned={state === "auto_returned"}
                  />
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
