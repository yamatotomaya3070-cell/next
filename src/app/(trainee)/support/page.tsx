import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { secondaryButtonClass } from "@/components/ui/buttons";
import {
  IconHelp,
  IconMessage,
  IconSettings,
  IconClock,
} from "@/components/ui/icons";

export const dynamic = "force-dynamic";

/** サポート・困ったときの案内 */
export default async function SupportPage() {
  await requireProfile();

  return (
    <PageContainer>
      <h1 className="text-xl font-bold text-ink">サポート</h1>
      <p className="mt-1 text-sm text-ink-soft">
        困ったとき・迷ったときは、無理をせずここから相談してください。
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="作業中に困ったとき" icon={<IconHelp />}>
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink">
            <li>案件の詳細画面にある「手順」をもう一度見てみましょう。</li>
            <li>
              それでも分からないときは、「メッセージ」画面からいつでも質問を送れます（作業の途中でも大丈夫です）。
            </li>
            <li>スタッフに直接声をかけても大丈夫です。</li>
          </ol>
          <p className="mt-3 rounded-xl bg-primary-soft/60 p-3 text-sm text-ink">
            質問することは、仕事を進めるための大切なスキルのひとつです。遠慮はいりません。
          </p>
        </SectionCard>

        <SectionCard title="質問する・やりとりを見る" icon={<IconMessage />}>
          <p className="text-[15px] text-ink-soft">
            メッセージ画面から、職員へいつでも質問を送れます。これまでの質問と回答もここで確認できます。
          </p>
          <Link href="/messages" className={`${secondaryButtonClass} mt-4`}>
            メッセージを開く
          </Link>
        </SectionCard>

        <SectionCard title="休憩について" icon={<IconClock />}>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            設定した間隔で休憩のお知らせが表示されます。疲れたら、お知らせを待たずに休憩して大丈夫です。
          </p>
        </SectionCard>

        <SectionCard title="画面の見え方を変える" icon={<IconSettings />}>
          <p className="text-[15px] text-ink-soft">
            ふりがな・文字の大きさ・読み上げなどは設定画面から変えられます。
          </p>
          <Link href="/settings" className={`${secondaryButtonClass} mt-4`}>
            設定を開く
          </Link>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
