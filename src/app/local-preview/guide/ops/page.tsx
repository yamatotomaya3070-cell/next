import { PageContainer } from "@/components/ui/PageContainer";
import { OpsIndex } from "@/components/guide/OpsIndex";
import { notFound } from "next/navigation";

/** 開発環境だけ（ログインなしで確認）：操作辞典の一覧と検索 */
export default function OpsIndexPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PageContainer>
      <OpsIndex basePath="/local-preview/guide" />
    </PageContainer>
  );
}
