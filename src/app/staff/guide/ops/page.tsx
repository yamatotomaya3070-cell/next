import { PageContainer } from "@/components/ui/PageContainer";
import { OpsIndex } from "@/components/guide/OpsIndex";

/** 職員向け：操作辞典の一覧と検索 */
export default function OpsIndexPage() {
  return (
    <PageContainer>
      <OpsIndex basePath="/staff/guide" />
    </PageContainer>
  );
}
