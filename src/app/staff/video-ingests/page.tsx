import { requireRole, createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/states";
import { IconSparkles } from "@/components/ui/icons";
import type { EditingPattern } from "@/lib/video/analysis/types";
import { UploadIngestForm } from "./UploadIngestForm";
import { AnalyzeButton } from "./AnalyzeButton";

export const dynamic = "force-dynamic";

interface IngestRow {
  id: string;
  title: string;
  genre_hint: string | null;
  status: string;
  consent_status: string;
  editing_pattern: EditingPattern | null;
  error: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  pending: "neutral",
  analyzing: "info",
  analyzed: "success",
  failed: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "解析待ち",
  analyzing: "解析中",
  analyzed: "解析済み",
  failed: "失敗",
};

export default async function VideoIngestsPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("video_ingests")
    .select("id, title, genre_hint, status, consent_status, editing_pattern, error, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const ingests = (data ?? []) as IngestRow[];

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <IconSparkles className="text-primary" />
          参考動画の取り込み・解析
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          クラウドワークスの参考動画や完成見本を取り込むと、AIが編集パターン（テンポ・テロップ量・構成など）を読み取ります。
          その特徴を案件生成に反映すると、実案件に近い編集水準の練習案件を作れます。
        </p>
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-ink">
          動画は職員のみが閲覧できます。実案件の動画は、依頼者の許諾を確認してから取り込んでください。
          解析はクラウド上で自動実行されます（数分以内に反映）。すぐに結果を見たいときは各動画の「今すぐ解析する」を押してください。
        </p>

        <div className="mt-6">
          <UploadIngestForm />
        </div>

        <div className="mt-8">
          <SectionCard title={`取り込み済み（${ingests.length}件）`} icon={<IconSparkles />}>
            {error ? (
              <p className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-ink">
                取り込み用のテーブルがまだ作成されていません。Supabase の SQL Editor で{" "}
                <code className="rounded bg-page px-1">supabase/migrations/00012_video_ingests.sql</code>{" "}
                を実行してください。
              </p>
            ) : ingests.length === 0 ? (
              <EmptyState
                title="まだ取り込みはありません"
                description="上のフォームから参考動画を取り込むと、AIが編集パターンを解析します。"
              />
            ) : (
              <ul className="space-y-3">
                {ingests.map((ing) => (
                  <li key={ing.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{ing.title}</span>
                      <StatusBadge
                        label={STATUS_LABEL[ing.status] ?? ing.status}
                        tone={STATUS_TONE[ing.status] ?? "neutral"}
                        size="sm"
                      />
                      <StatusBadge
                        label={ing.consent_status === "approved" ? "許諾済み" : "許諾保留"}
                        tone={ing.consent_status === "approved" ? "success" : "warning"}
                        size="sm"
                      />
                      <span className="text-xs text-ink-soft">
                        {new Date(ing.created_at).toLocaleDateString("ja-JP")}
                      </span>
                    </div>

                    {ing.status === "analyzed" && ing.editing_pattern && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <dt className="text-ink-soft">ジャンル</dt>
                        <dd className="text-ink">{ing.editing_pattern.genre}</dd>
                        <dt className="text-ink-soft">テンポ</dt>
                        <dd className="text-ink">
                          {ing.editing_pattern.pacing}（約{ing.editing_pattern.estimatedCutsPerMinute}カット/分）
                        </dd>
                        <dt className="text-ink-soft">テロップ量</dt>
                        <dd className="text-ink">{ing.editing_pattern.telop.density}</dd>
                        <dt className="text-ink-soft">構成</dt>
                        <dd className="text-ink">{ing.editing_pattern.structure.join(" → ")}</dd>
                      </dl>
                    )}
                    {ing.status === "failed" && ing.error && (
                      <p className="mt-2 text-sm text-danger">解析に失敗しました: {ing.error}</p>
                    )}
                    {(ing.status === "pending" || ing.status === "analyzing") && (
                      <p className="mt-2 text-sm text-ink-soft">
                        クラウドでの自動解析を待っています（数分以内）。すぐに実行することもできます。
                      </p>
                    )}
                    {ing.status !== "analyzing" && (
                      <AnalyzeButton id={ing.id} />
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
