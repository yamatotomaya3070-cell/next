import { PageContainer } from "@/components/ui/PageContainer";
import { GuideIndex } from "@/components/guide/GuideIndex";

/** 職員向け：動画編集の教科書（目次）。パソコンの準備の章も含む。 */
export default function StaffGuidePage() {
  return (
    <PageContainer>
      <GuideIndex basePath="/staff/guide" audience="staff" />
    </PageContainer>
  );
}
