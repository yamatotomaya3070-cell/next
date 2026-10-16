import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { OpView } from "@/components/guide/OpView";
import { GUIDE_OPERATIONS, getOperation } from "@/lib/guide/operations";

export function generateStaticParams() {
  return GUIDE_OPERATIONS.map((op) => ({ id: op.id }));
}

/** 利用者向け：操作辞典の1項目 */
export default async function OpPage({ params }: { params: Promise<{ id: string }> }) {

  const { id } = await params;
  const op = getOperation(id);
  if (!op) notFound();
  return (
    <PageContainer>
      <OpView op={op} basePath="/guide" />
    </PageContainer>
  );
}
