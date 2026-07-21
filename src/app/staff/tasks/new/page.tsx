import { requireRole } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { IconSparkles } from "@/components/ui/icons";
import { GenerateTaskForm } from "./GenerateTaskForm";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  await requireRole("staff", "admin");

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
        <div className="mt-5">
          <SectionCard>
            <GenerateTaskForm />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
