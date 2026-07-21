import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, createClient } from "@/lib/supabase/server";
import type { Profile, Task, TaskMaterial } from "@/lib/types";
import { SKILL_TAG_LABELS } from "@/lib/types";
import { approveMaterial, publishTask } from "@/lib/actions/staff";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge, TaskTypeBadge } from "@/components/ui/StatusBadge";
import { primaryButtonClass } from "@/components/ui/buttons";
import {
  IconChevronLeft,
  IconClipboard,
  IconUsers,
} from "@/components/ui/icons";
import { AssignForm } from "./AssignForm";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  request_doc: "模擬依頼書",
  manual: "手順書",
  script: "台本",
  sample: "完成見本",
  revision_note: "チェックリスト・修正指示",
  screenshot_guide: "スクショガイド",
};

export default async function StaffTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const [
    { data: taskData },
    { data: materialsData },
    { data: traineesData },
    { data: assignmentsData },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).single(),
    supabase
      .from("task_materials")
      .select("*")
      .eq("task_id", id)
      .order("sort_order"),
    supabase.from("profiles").select("*").eq("role", "trainee"),
    supabase.from("task_assignments").select("user_id").eq("task_id", id),
  ]);

  if (!taskData) notFound();
  const task = taskData as Task;
  const materials = (materialsData ?? []) as TaskMaterial[];
  const trainees = (traineesData ?? []) as Profile[];
  const assignedUserIds = new Set(
    ((assignmentsData ?? []) as { user_id: string }[]).map((a) => a.user_id),
  );
  const unassigned = trainees.filter((t) => !assignedUserIds.has(t.id));
  const allApproved =
    materials.length > 0 && materials.every((m) => m.is_approved);

  return (
    <PageContainer>
      <Link
        href="/staff/tasks"
        className="inline-flex min-h-11 items-center gap-1 font-bold text-primary hover:text-primary-dark hover:underline"
      >
        <IconChevronLeft className="size-4" />
        案件管理にもどる
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{task.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <TaskTypeBadge type={task.type} size="sm" />
            <StatusBadge
              label={task.status === "published" ? "公開中" : "下書き"}
              tone={task.status === "published" ? "success" : "neutral"}
              size="sm"
            />
            <span
              aria-label={`難易度 ${task.difficulty} / 5`}
              className="rounded-full bg-page px-3 py-0.5 text-ink"
            >
              難易度 {"★".repeat(task.difficulty)}
            </span>
            {task.skill_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary-soft px-3 py-0.5 text-primary-dark"
              >
                {SKILL_TAG_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>
        </div>
        {task.status !== "published" && (
          <form
            action={async () => {
              "use server";
              await publishTask(id);
            }}
          >
            <button
              type="submit"
              disabled={!allApproved}
              className={primaryButtonClass}
              title={allApproved ? "" : "すべての資料を承認すると公開できます"}
            >
              案件を公開する
            </button>
          </form>
        )}
      </div>

      {/* 資料一覧 */}
      <div className="mt-6">
        <SectionCard title="案件資料（AI生成の下書き）" icon={<IconClipboard />}>
          <p className="text-sm text-ink-soft">
            内容を確認して承認してください。承認済みの資料だけが就労者に表示されます。
          </p>
          <div className="mt-4 space-y-4">
            {materials.length === 0 && (
              <p className="text-sm text-ink-soft">資料がまだありません。</p>
            )}
            {materials.map((material) => (
              <div
                key={material.id}
                className="rounded-xl border border-line p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusBadge
                      label={KIND_LABELS[material.kind] ?? material.kind}
                      tone="info"
                      size="sm"
                    />
                    <span className="font-bold text-ink">{material.title}</span>
                    <StatusBadge
                      label={material.is_approved ? "承認済み" : "未承認"}
                      tone={material.is_approved ? "success" : "warning"}
                      size="sm"
                    />
                  </div>
                  {!material.is_approved && (
                    <form
                      action={async () => {
                        "use server";
                        await approveMaterial(material.id, id);
                      }}
                    >
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark"
                      >
                        この資料を承認する
                      </button>
                    </form>
                  )}
                </div>
                {material.content && (
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-page p-4 text-sm leading-relaxed text-ink">
                    {material.content}
                  </pre>
                )}
                {material.steps && (
                  <ol className="mt-3 max-h-64 list-decimal space-y-1.5 overflow-auto rounded-xl bg-page p-4 pl-8 text-sm leading-relaxed text-ink">
                    {material.steps.map((step, i) => (
                      <li key={i}>
                        {step.text}
                        {step.tip && (
                          <span className="text-amber-700">
                            （ヒント: {step.tip}）
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* 割り当て */}
      <div className="mt-6">
        <SectionCard title="就労者への配布" icon={<IconUsers />}>
          {task.status !== "published" ? (
            <p className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-[15px] text-ink">
              案件を公開すると配布できるようになります。
            </p>
          ) : (
            <AssignForm
              taskId={id}
              trainees={unassigned.map((t) => ({
                id: t.id,
                name: t.display_name,
              }))}
              assignedCount={assignedUserIds.size}
              defaultDueDays={task.due_in_days ?? 3}
            />
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
