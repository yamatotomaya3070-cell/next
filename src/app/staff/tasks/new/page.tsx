import Link from "next/link";
import { requireRole, createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { IconGlobe, IconSparkles } from "@/components/ui/icons";
import { GenerateTaskForm } from "./GenerateTaskForm";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  // 蓄積済みの実案件ナレッジ件数（テーブル未適用時は null → 案内を表示）
  const { count: knowledgeCount, error: knowledgeError } = await supabase
    .from("case_knowledge")
    .select("id", { count: "exact", head: true });

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <IconSparkles className="text-primary" />
          模擬案件をAIで生成する
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          テーマとスキルを指定すると、AIが模擬依頼書・手順書・台本・チェックリストを下書きします。
          生成後に内容を確認・承認してから就労者に公開されます。
        </p>

        {!knowledgeError && (knowledgeCount ?? 0) > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-teal/30 bg-teal-soft p-3 text-sm text-ink">
            <IconGlobe className="mt-0.5 size-4 shrink-0 text-teal" />
            <span>
              蓄積済みの実案件ナレッジ {knowledgeCount}
              件（依頼の傾向・注意事項）を参考にして、より本番に近い案件を生成します。
            </span>
          </p>
        ) : (
          <p className="mt-3 rounded-xl bg-page p-3 text-sm text-ink-soft">
            実案件のナレッジはまだありません。
            <Link
              href="/staff/cases/new"
              className="font-bold text-primary hover:underline"
            >
              CrowdWorks案件の取り込み
            </Link>
            で実案件を登録すると、その傾向を反映した生成ができるようになります。
          </p>
        )}

        <div className="mt-5">
          <SectionCard>
            <GenerateTaskForm />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
