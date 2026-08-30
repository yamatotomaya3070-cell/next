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
import { StepViewer } from "@/components/StepViewer";
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

export const dynamic = "force-dynamic";

function parseSelfCheckItems(material: TaskMaterial | undefined): string[] {
  if (!material?.content) {
    return [
      "依頼書のとおりに作業した",
      "最初から最後まで見直した",
      "指定されたファイル形式で書き出した",
    ];
  }
  try {
    const parsed = JSON.parse(material.content);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return material.content.split("\n").filter(Boolean);
  }
}

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

  const requestDoc = materials.find((m) => m.kind === "request_doc");
  const manual = materials.find((m) => m.kind === "manual");
  const script = materials.find((m) => m.kind === "script");
  const checkList = materials.find((m) => m.kind === "revision_note");
  // 完成見本(kind='sample')は「答え」なので利用者には見せない（スタッフ専用）。
  // 利用者には支給素材(source_assets)のみ配布する。
  const downloadable = materials.filter(
    (m) => m.kind === "source_assets" && m.media_url,
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
  const selfCheckItems = parseSelfCheckItems(checkList);

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
      label: "作業手順",
      icon: "🧭",
      content: (
        <div className="space-y-5">
          <StepViewer
            steps={manual?.steps ?? []}
            stepModeEnabled={profile.step_mode_enabled}
            readAloudEnabled={profile.read_aloud_enabled}
          />
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
              : "request"
          }
        />
      </div>
    </PageContainer>
  );
}
