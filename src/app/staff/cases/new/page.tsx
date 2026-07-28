import Link from "next/link";
import { requireRole, createClient } from "@/lib/supabase/server";
import { SKILL_TAG_LABELS, type CaseKnowledge } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/states";
import { IconGlobe, IconSparkles } from "@/components/ui/icons";
import { RealCaseForm } from "./RealCaseForm";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  // 蓄積済みナレッジ（テーブル未適用の場合は null エラーになるため表示を分ける）
  const { data: knowledgeData, error: knowledgeError } = await supabase
    .from("case_knowledge")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  const knowledge = (knowledgeData ?? []) as CaseKnowledge[];

  // 解析済みの取り込み動画（編集パターン注入用の選択肢）。テーブル未適用ならエラーを握りつぶす
  const { data: ingestData } = await supabase
    .from("video_ingests")
    .select("id, title, editing_pattern")
    .eq("status", "analyzed")
    .order("created_at", { ascending: false })
    .limit(50);
  const ingests = (ingestData ?? []).map((i) => {
    const pattern = i.editing_pattern as { genre?: string } | null;
    return { id: i.id as string, title: i.title as string, genre: pattern?.genre ?? null };
  });

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <IconGlobe className="text-primary" />
          CrowdWorks案件（実案件）の取り込み
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          実際に届いた案件の依頼文を貼り付けると、AIが固有名詞を匿名化した上で、同じスキル・同じ要求水準の「類似の練習案件」を下書きします。
          保存すると、案件のジャンル・難易度・注意事項が自動でナレッジに蓄積され、以後の模擬案件の生成に活かされます。
        </p>
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-ink">
          実案件の依頼文はこの生成にのみ使用し、匿名化前のテキストは保存されません。NDA・守秘義務のある案件は、依頼者の許諾範囲を確認してから使用してください。
        </p>

        <div className="mt-6">
          <RealCaseForm ingests={ingests} />
        </div>

        {/* 蓄積済みナレッジ */}
        <div className="mt-8">
          <SectionCard
            title={`蓄積済みの実案件ナレッジ（${knowledge.length}件）`}
            icon={<IconSparkles />}
          >
            {knowledgeError ? (
              <p className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-ink">
                ナレッジ用のテーブルがまだ作成されていません。Supabase の SQL
                Editor で{" "}
                <code className="rounded bg-page px-1">
                  supabase/migrations/00005_case_knowledge.sql
                </code>{" "}
                を実行すると、実案件の投入時に自動でナレッジが蓄積されるようになります。
              </p>
            ) : knowledge.length === 0 ? (
              <EmptyState
                title="ナレッジはまだありません"
                description="上のフォームから実案件を取り込むと、ジャンル・難易度・注意事項が自動で蓄積されます。"
              />
            ) : (
              <ul className="space-y-3">
                {knowledge.map((k) => (
                  <li key={k.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{k.title}</span>
                      {k.genre && (
                        <StatusBadge label={k.genre} tone="info" size="sm" />
                      )}
                      {k.difficulty && (
                        <span
                          aria-label={`難易度 ${k.difficulty} / 5`}
                          className="rounded-full bg-page px-2.5 py-0.5 text-xs text-ink"
                        >
                          難易度 {"★".repeat(k.difficulty)}
                        </span>
                      )}
                      <span className="text-xs text-ink-soft">
                        {new Date(k.created_at).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {k.skill_tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-dark"
                        >
                          {SKILL_TAG_LABELS[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                    {k.caution_points.length > 0 && (
                      <div className="mt-2 text-sm">
                        <p className="font-bold text-ink-soft">注意事項</p>
                        <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-ink">
                          {k.caution_points.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {k.converted_task_id && (
                      <Link
                        href={`/staff/tasks/${k.converted_task_id}`}
                        className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-primary hover:text-primary-dark hover:underline"
                      >
                        生成された練習案件を見る →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
