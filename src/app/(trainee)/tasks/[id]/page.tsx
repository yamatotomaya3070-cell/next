import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, createClient } from "@/lib/supabase/server";
import type {
  Feedback,
  Submission,
  Task,
  TaskAssignment,
  TaskMaterial,
} from "@/lib/types";
import { Furigana } from "@/components/Furigana";
import { MarkdownLite } from "@/components/MarkdownLite";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { WorkTimer } from "@/components/WorkTimer";
import { SubmitForm } from "@/components/SubmitForm";
import { QuestionForm } from "@/components/QuestionForm";
import { TaskTabs, type TaskTab } from "@/components/TaskTabs";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  AssignmentStatusBadge,
  TaskTypeBadge,
} from "@/components/ui/StatusBadge";
import {
  IconCalendar,
  IconChevronLeft,
  IconClock,
  IconFileText,
  IconUsers,
} from "@/components/ui/icons";
import { formatDue } from "@/components/work/AssignmentCard";
import { FeedbackView } from "./FeedbackView";
import { WorkSteps } from "@/components/work/WorkSteps";
import { getWorkSteps } from "@/lib/guide/workflow";
import {
  pickChecklistItems,
  pickDownloadableMaterials,
  pickInstructionSheet,
} from "@/lib/tasks/pickMaterials";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: assignmentRow } = await supabase
    .from("task_assignments")
    .select("*, tasks(*)")
    .eq("id", id)
    .eq("user_id", profile.id)
    .single();
  if (!assignmentRow) notFound();

  const assignment = assignmentRow as unknown as TaskAssignment & {
    tasks: Task;
  };
  const task = assignment.tasks;

  const [{ data: materialsData }, { data: submissionsData }, staffRes] =
    await Promise.all([
      supabase
        .from("task_materials")
        .select("*")
        .eq("task_id", task.id)
        .eq("is_approved", true)
        .order("sort_order"),
      supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", assignment.id)
        .order("version", { ascending: false }),
      assignment.assigned_by
        ? supabase
            .from("profiles")
            .select("display_name")
            .eq("id", assignment.assigned_by)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  const materials = (materialsData ?? []) as TaskMaterial[];
  const submissions = (submissionsData ?? []) as Submission[];
  const staffName = staffRes.data?.display_name ?? null;

  let feedbacks: Feedback[] = [];
  if (submissions.length > 0) {
    const { data: fbData } = await supabase
      .from("feedback")
      .select("*")
      .in(
        "submission_id",
        submissions.map((s) => s.id),
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    feedbacks = (fbData ?? []) as Feedback[];
  }

  // 最新の提出（submissions は version の降順）に結果がまだ無ければ「採点中」を出す
  const latestSubmissionId = submissions[0]?.id ?? null;
  const awaitingResult =
    latestSubmissionId !== null &&
    !feedbacks.some((f) => f.submission_id === latestSubmissionId);

  const requestDoc = materials.find((m) => m.kind === "request_doc");
  const script = materials.find((m) => m.kind === "script");
  const instructionSheet = pickInstructionSheet(materials);
  // 「YouTube動画生成」で作った案件の素材だけが［絆_素材を並べる］の決まりに合う
  // （登録前に scripts/scene/verifyPackage.ts で、見本どおりに並ぶことを確かめてある）
  const autoArrange = materials.some(
    (m) => m.kind === "source_assets" && m.media_url?.startsWith("scene-nisa/"),
  );
  // 支給素材は常に、完成見本は職員の設定（提出前から公開 / 提出後に公開）に従って配布する
  const downloadable = pickDownloadableMaterials(
    materials,
    submissions.length > 0,
  );
  // media_url は private バケット 'materials' 内の相対パス。都度署名付きURLを発行する
  const signedDownloads = await Promise.all(
    downloadable.map(async (m) => {
      const { data } = await supabase.storage
        .from("materials")
        .createSignedUrl(m.media_url!, 60 * 60);
      return { material: m, url: data?.signedUrl ?? null };
    }),
  );
  const samples = signedDownloads.filter((d) => d.url);
  const selfCheckItems = pickChecklistItems(materials);

  const tabs: TaskTab[] = [
    {
      id: "request",
      label: "依頼内容",
      icon: "📄",
      content: (
        <div className="space-y-5">
          {/* 案件概要 */}
          {task.summary && (
            <SectionCard title="案件の概要">
              <p className="text-[15px] leading-relaxed text-ink">
                <Furigana text={task.summary} />
              </p>
            </SectionCard>
          )}

          {/* 依頼内容 */}
          <SectionCard title={requestDoc?.title ?? "依頼内容"}>
            {profile.read_aloud_enabled && requestDoc?.content && (
              <div className="mb-3">
                <ReadAloudButton text={requestDoc.content} />
              </div>
            )}
            {requestDoc?.content ? (
              <MarkdownLite
                text={requestDoc.content}
                omitLeadingHeading={requestDoc.title}
              />
            ) : (
              <p className="text-ink-soft">依頼書は準備中です。</p>
            )}
          </SectionCard>

          {/* 納品条件（依頼書に含まれる想定。専用データ項目は未実装） */}
          <SectionCard title="納品条件">
            <p className="text-[15px] leading-relaxed text-ink-soft">
              ファイル形式や長さなどの納品条件は、上の依頼内容に書かれています。分からないことがあれば、下の「レビュー結果」タブや「メッセージ」画面から、作業の途中でもいつでも質問できます。
            </p>
          </SectionCard>

          {/* 素材ファイル */}
          <SectionCard title="素材ファイル">
            {samples.length === 0 ? (
              <p className="text-[15px] text-ink-soft">
                この案件の素材ファイルはありません。スタッフから受け取った素材を使ってください。
              </p>
            ) : (
              <ul className="space-y-2">
                {samples.map(({ material: m, url }) => (
                  <li key={m.id}>
                    <a
                      href={url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-2 rounded-xl border border-line p-3 font-medium text-primary transition hover:bg-primary-soft"
                    >
                      <IconFileText className="size-4" />
                      {m.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ),
    },
    {
      id: "manual",
      label: "作業のしかた",
      icon: "🧭",
      content: (
        <div className="space-y-5">
          <WorkSteps
            steps={getWorkSteps("/guide", { autoArrange })}
            assignmentId={assignment.id}
            readAloudEnabled={profile.read_aloud_enabled}
          />
          {instructionSheet?.content && (
            <SectionCard title="作業指示一覧">
              <p className="text-[15px] leading-relaxed text-ink-soft">
                字幕に入れる文字と、強調テロップを入れる場面が書いてあります。字幕は、ここから文をコピーして貼ります。
              </p>
              <details className="group mt-3" id="instruction-sheet">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border-2 border-primary/30 bg-primary-soft/40 px-4 text-[15px] font-bold text-primary transition hover:bg-primary-soft">
                  <span className="group-open:hidden">作業指示一覧をひらく</span>
                  <span className="hidden group-open:inline">作業指示一覧をとじる</span>
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <MarkdownLite
                    text={instructionSheet.content}
                    omitLeadingHeading={instructionSheet.title}
                  />
                </div>
              </details>
            </SectionCard>
          )}
          {script?.content && (
            <SectionCard title={script.title}>
              <p className="whitespace-pre-wrap rounded-xl bg-accent-purple-soft/50 p-4 text-[16px] leading-loose text-ink">
                {script.content}
              </p>
            </SectionCard>
          )}
        </div>
      ),
    },
    {
      id: "submit",
      label: "提出",
      icon: "📤",
      content: (
        <div className="space-y-5">
          {submissions.length > 0 && (
            <p className="rounded-xl border border-primary/20 bg-primary-soft p-4 text-[15px] text-ink">
              これまでに {submissions.length} 回提出しています（最新:{" "}
              {submissions[0].file_name}
              ）。もう一度提出すると、新しいバージョンになります。
            </p>
          )}
          <SubmitForm
            assignmentId={assignment.id}
            userId={profile.id}
            selfCheckItems={selfCheckItems}
          />
        </div>
      ),
    },
    {
      id: "result",
      label: "レビュー結果",
      icon: "💬",
      badge: feedbacks.length > 0 ? String(feedbacks.length) : undefined,
      content: (
        <div className="space-y-5">
          <FeedbackView
            feedbacks={feedbacks}
            hasSubmission={submissions.length > 0}
            assignmentStatus={assignment.status}
            awaitingResult={awaitingResult}
          />
          <SectionCard title="質問する">
            <QuestionForm assignmentId={assignment.id} />
          </SectionCard>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <Link
        href="/home"
        className="inline-flex min-h-11 items-center gap-1 font-bold text-primary hover:text-primary-dark hover:underline"
      >
        <IconChevronLeft className="size-4" />
        ホームにもどる
      </Link>

      {/* 案件ヘッダー */}
      <div className="mt-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <TaskTypeBadge type={task.type} size="sm" />
          <AssignmentStatusBadge status={assignment.status} size="sm" />
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-snug text-ink">
          {task.title}
        </h1>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[15px] text-ink-soft">
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1">
              <IconCalendar className="size-4" />
              納期
            </dt>
            <dd className="font-medium text-ink">{formatDue(assignment.due_at)}</dd>
          </div>
          {task.estimated_minutes && (
            <div className="flex items-center gap-1.5">
              <dt className="flex items-center gap-1">
                <IconClock className="size-4" />
                目安
              </dt>
              <dd className="font-medium text-ink">
                約{task.estimated_minutes}分
              </dd>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1">
              <IconUsers className="size-4" />
              担当スタッフ
            </dt>
            <dd className="font-medium text-ink">
              {staffName ? `${staffName} さん` : "施設スタッフ"}
            </dd>
          </div>
        </dl>
      </div>

      {/* 作業タイマー（作業を始める/再開する） */}
      <div className="mt-4">
        <WorkTimer
          assignmentId={assignment.id}
          estimatedMinutes={task.estimated_minutes}
          alreadyStarted={assignment.status !== "not_started"}
        />
      </div>

      <div className="mt-5">
        <TaskTabs
          tabs={tabs}
          initialTab={
            assignment.status === "feedback" || feedbacks.length > 0
              ? "result"
              : assignment.status === "in_progress"
                ? "manual" // 作業中の人は、毎回タブを押し直さずに続きから始められる
                : "request"
          }
        />
      </div>
    </PageContainer>
  );
}
