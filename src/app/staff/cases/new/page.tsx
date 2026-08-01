import { requireRole, createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { IconGlobe } from "@/components/ui/icons";
import { DistributeCaseForm, type TraineeOption } from "./DistributeCaseForm";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  // 配布先の候補（利用者）
  const { data: traineesData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("role", "trainee")
    .order("display_name");
  const trainees: TraineeOption[] = ((traineesData ?? []) as Pick<Profile, "id" | "display_name">[]).map(
    (t) => ({ id: t.id, name: t.display_name }),
  );

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <IconGlobe className="text-primary" />
          CrowdWorks案件を配布する
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          受注した実際の案件を、そのまま利用者に配布します。依頼文を貼り付けると、AIが利用者向けの読みやすい依頼書と手順書を用意します。
          内容を確認して利用者を選ぶと、その人の「受注案件」に届きます。
        </p>
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-ink">
          実案件の依頼文に含まれる企業名・個人名・連絡先はAIが「あるお店」「依頼者」等に置き換えます。
          NDA・守秘義務のある案件は、依頼者の許諾範囲を確認してから配布してください。
        </p>

        <div className="mt-6">
          <DistributeCaseForm trainees={trainees} />
        </div>
      </div>
    </PageContainer>
  );
}
