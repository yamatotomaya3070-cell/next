import Link from "next/link";
import { requireRole } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { IconUsers } from "@/components/ui/icons";
import { NewUserForm } from "./NewUserForm";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const caller = await requireRole("staff", "admin");

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
            <IconUsers className="text-primary" />
            利用者・職員を追加
          </h1>
          <Link href="/staff/users" className="text-sm font-bold text-primary hover:underline">
            ← 一覧へ戻る
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          アカウントを作成すると、その場でログインできるようになります（確認メールは不要です）。
          発行したメールアドレスと初期パスワードを本人にお渡しください。
        </p>

        <div className="mt-6">
          <SectionCard>
            <NewUserForm canCreateAdmin={caller.role === "admin"} />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
