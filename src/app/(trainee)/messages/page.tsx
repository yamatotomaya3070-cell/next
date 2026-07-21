import { requireProfile, createClient } from "@/lib/supabase/server";
import type { QaLog } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconMessage } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

/** 質問と回答のやりとり一覧（qa_logs） */
export default async function MessagesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("qa_logs")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );
  }

  const logs = (data ?? []) as QaLog[];

  return (
    <PageContainer>
      <h1 className="text-xl font-bold text-ink">メッセージ</h1>
      <p className="mt-1 text-sm text-ink-soft">
        案件について送った質問と、その回答の一覧です。質問は各案件の詳細画面から送れます。
      </p>

      {logs.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconMessage />}
            title="まだメッセージはありません"
            description="困ったことがあれば、案件の詳細画面から気軽に質問してください。"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {logs.map((log) => (
            <SectionCard key={log.id}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span>
                  {new Date(log.created_at).toLocaleString("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                {log.answer ? (
                  <StatusBadge label="回答あり" tone="success" size="sm" />
                ) : (
                  <StatusBadge label="回答待ち" tone="warning" size="sm" />
                )}
              </div>
              <p className="mt-2 rounded-xl bg-page p-3 text-[15px] leading-relaxed text-ink">
                <span className="mb-1 block text-xs font-bold text-ink-soft">
                  あなたの質問
                </span>
                {log.question}
              </p>
              {log.answer && (
                <p className="mt-2 rounded-xl bg-primary-soft/60 p-3 text-[15px] leading-relaxed text-ink">
                  <span className="mb-1 block text-xs font-bold text-primary-dark">
                    {log.answered_by === "ai" ? "作業サポートAI" : "スタッフ"}
                    からの回答
                  </span>
                  {log.answer}
                </p>
              )}
            </SectionCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
