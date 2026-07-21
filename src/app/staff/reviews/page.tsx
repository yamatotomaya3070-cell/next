import { requireRole, createClient } from "@/lib/supabase/server";
import type { Feedback, SelfCheckItem } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  IconCheckCircle,
  IconCheckSquare,
  IconFileText,
  IconRobot,
} from "@/components/ui/icons";
import { ReviewForm } from "./ReviewForm";

export const dynamic = "force-dynamic";

interface PendingReview extends Feedback {
  submissions: {
    id: string;
    file_name: string | null;
    file_path: string | null;
    note: string | null;
    work_minutes: number | null;
    self_check: SelfCheckItem[] | null;
    version: number;
    assignment_id: string;
    task_assignments: {
      id: string;
      user_id: string;
      profiles: { display_name: string } | null;
      tasks: { title: string } | null;
    } | null;
  } | null;
}

export default async function ReviewsPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("feedback")
    .select(
      `*, submissions(
        id, file_name, file_path, note, work_minutes, self_check, version, assignment_id,
        task_assignments(id, user_id, profiles(display_name), tasks(title))
      )`,
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const reviews = (data ?? []) as unknown as PendingReview[];

  return (
    <PageContainer>
      <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
        <IconCheckSquare className="text-primary" />
        提出レビュー
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        AIが下書きしたレビュー結果を確認し、必要なら修正して承認してください。承認した内容だけが就労者に表示されます。
      </p>

      {reviews.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconCheckCircle />}
            title="承認待ちのレビューはありません"
            description="新しい提出があると、AIレビューの下書きがここに表示されます。"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {reviews.map((review) => {
            const sub = review.submissions;
            const assignment = sub?.task_assignments;
            const userName = assignment?.profiles?.display_name ?? "不明な利用者";
            return (
              <SectionCard key={review.id}>
                <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
                  <UserAvatar name={userName} size="sm" />
                  <span className="font-bold text-ink">{userName} さん</span>
                  <span className="text-ink-soft">{assignment?.tasks?.title}</span>
                  <StatusBadge
                    label={`提出 ${sub?.version ?? 1}回目`}
                    tone="neutral"
                    size="sm"
                  />
                  {sub?.work_minutes != null && (
                    <StatusBadge
                      label={`作業 ${sub.work_minutes}分`}
                      tone="neutral"
                      size="sm"
                    />
                  )}
                </div>

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div className="text-sm">
                    <p className="flex items-center gap-1.5 font-bold text-ink-soft">
                      <IconFileText className="size-4" />
                      提出情報
                    </p>
                    <p className="mt-2 font-medium text-ink">
                      {sub?.file_name ?? "ファイルなし"}
                    </p>
                    {sub?.note && (
                      <p className="mt-2 rounded-xl bg-page p-3 leading-relaxed text-ink">
                        {sub.note}
                      </p>
                    )}
                    {sub?.self_check && sub.self_check.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {sub.self_check.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              aria-hidden
                              className={
                                c.checked ? "text-success" : "text-ink-soft"
                              }
                            >
                              {c.checked ? "✓" : "－"}
                            </span>
                            <span
                              className={c.checked ? "text-ink" : "text-ink-soft"}
                            >
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
                      AIレビューの下書き（スコア {review.score ?? "--"} 点）
                    </p>
                    {review.good_points && review.good_points.length > 0 && (
                      <div className="mt-2 rounded-xl bg-success-soft p-3">
                        <p className="text-xs font-bold text-success">
                          良かった点
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                          {review.good_points.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {review.improve_points &&
                      review.improve_points.length > 0 && (
                        <div className="mt-2 rounded-xl bg-warning-soft p-3">
                          <p className="text-xs font-bold text-amber-700">
                            改善ポイント
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                            {review.improve_points.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <ReviewForm
                    feedbackId={review.id}
                    assignmentId={sub?.assignment_id ?? ""}
                    defaultScore={review.score ?? 70}
                    defaultSummary={review.summary ?? ""}
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
