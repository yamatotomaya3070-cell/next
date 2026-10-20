import { PageContainer } from "@/components/ui/PageContainer";
import { GuideIndex } from "@/components/guide/GuideIndex";
import { loadLessonProgress } from "@/lib/guide/lessons/progress";
import { createClient, requireProfile } from "@/lib/supabase/server";

/** 利用者向け：動画編集の教科書（目次）。どこまでできたかと、次のレッスンを出す */
export default async function TraineeGuidePage() {
  const profile = await requireProfile();
  const progress = profile.role === "trainee" ? await loadLessonProgress(await createClient(), profile.id) : undefined;
  return (
    <PageContainer>
      <GuideIndex basePath="/guide" audience="trainee" progress={progress} />
    </PageContainer>
  );
}
