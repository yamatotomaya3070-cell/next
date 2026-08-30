import Link from "next/link";
import { requireRole, createClient } from "@/lib/supabase/server";
import type { ManualGuideline } from "@/lib/types";
import { SKILL_TAG_LABELS } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NewGuidelineForm, ToggleActiveButton } from "./GuidelineForms";

export const dynamic = "force-dynamic";

export default async function GuidelinesPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("manual_guidelines")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  const guidelines = (data ?? []) as ManualGuideline[];
  const activeCount = guidelines.filter((g) => g.is_active).length;
  const tableMissing = Boolean(error);

  return (
    <PageContainer>
      <div className="mt-2">
        <h1 className="text-2xl font-bold text-ink">手順の学習ルール</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          作業手順の修正を「何を直すか(ルール)」＋「なぜ直すか(理由)」ごと記録する学習DBです。
          有効なルールは、これから生成される案件の手順に<b>自動で反映</b>され、同じ間違いを繰り返さなくなります。
          個々の案件の手順を直したいときは、各案件の詳細ページから編集できます。
        </p>
      </div>

      {tableMissing && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning-soft p-4 text-[15px] text-ink">
          テーブルがまだ作成されていません。
          <code className="mx-1 rounded bg-page px-1">
            supabase/migrations/00019_manual_guidelines.sql
          </code>
          を Supabase に適用してください。
        </div>
      )}

      <div className="mt-6">
        <SectionCard title={`学習済みルール（有効 ${activeCount} 件 / 全 ${guidelines.length} 件）`}>
          {guidelines.length === 0 ? (
            <p className="text-[15px] text-ink-soft">
              まだルールがありません。案件の手順を直したときに登録するか、下のフォームから追加してください。
            </p>
          ) : (
            <ul className="space-y-4">
              {guidelines.map((g) => (
                <li
                  key={g.id}
                  className={`rounded-xl border p-4 ${
                    g.is_active
                      ? "border-line bg-surface"
                      : "border-line bg-page opacity-70"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-ink">{g.title}</span>
                    <ToggleActiveButton
                      guidelineId={g.id}
                      isActive={g.is_active}
                    />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink">
                    <span className="font-bold text-ink-soft">ルール: </span>
                    {g.rule}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">
                    <span className="font-bold text-ink-soft">理由: </span>
                    {g.reason}
                  </p>
                  {(g.example_before || g.example_after) && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {g.example_before && (
                        <p className="rounded-lg bg-danger/5 p-2 text-xs text-ink">
                          <span className="font-bold text-danger">NG: </span>
                          {g.example_before}
                        </p>
                      )}
                      {g.example_after && (
                        <p className="rounded-lg bg-success-soft p-2 text-xs text-ink">
                          <span className="font-bold text-success">OK: </span>
                          {g.example_after}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {g.skill_tags.length === 0 ? (
                      <StatusBadge label="全案件に適用" tone="info" size="sm" />
                    ) : (
                      g.skill_tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-dark"
                        >
                          {SKILL_TAG_LABELS[t] ?? t}
                        </span>
                      ))
                    )}
                    {g.source_task_id && (
                      <Link
                        href={`/staff/tasks/${g.source_task_id}`}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        修正元の案件を見る →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="新しいルールを追加">
          <p className="mb-3 text-sm text-ink-soft">
            案件を経由せず、直接ルールを登録します。理由（なぜ）は必ず書いてください。
          </p>
          <NewGuidelineForm />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
