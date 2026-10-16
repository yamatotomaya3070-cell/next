import { PageContainer } from "@/components/ui/PageContainer";
import { OpsIndex } from "@/components/guide/OpsIndex";

/** 利用者向け：操作辞典の一覧と検索 */
export default function OpsIndexPage() {
  return (
    <PageContainer>
      <OpsIndex basePath="/guide" />
    </PageContainer>
  );
}
