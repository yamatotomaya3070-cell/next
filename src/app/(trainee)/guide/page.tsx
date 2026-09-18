import { PageContainer } from "@/components/ui/PageContainer";
import { GuideIndex } from "@/components/guide/GuideIndex";

/** 利用者向け：動画編集の教科書（目次） */
export default function TraineeGuidePage() {
  return (
    <PageContainer>
      <GuideIndex basePath="/guide" audience="trainee" />
    </PageContainer>
  );
}
