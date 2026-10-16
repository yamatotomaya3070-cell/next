import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { OpView } from "@/components/guide/OpView";
import { getOperation } from "@/lib/guide/operations";

/** 開発環境だけ（ログインなしで確認）：操作辞典の1項目 */
export default async function OpPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { id } = await params;
  const op = getOperation(id);
  if (!op) notFound();
  return (
    <PageContainer>
      <OpView op={op} basePath="/local-preview/guide" />
    </PageContainer>
  );
}
