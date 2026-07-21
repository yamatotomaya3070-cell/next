import { requireProfile } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { IconSettings } from "@/components/ui/icons";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <PageContainer>
      <div className="mx-auto max-w-xl">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <IconSettings className="text-primary" />
          見え方の設定
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          自分が使いやすいように、画面の見え方を変えられます。
        </p>
        <div className="mt-5">
          <SectionCard>
            <SettingsForm profile={profile} />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
