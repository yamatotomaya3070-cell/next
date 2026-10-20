import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { LessonView } from "@/components/guide/LessonView";
import { LESSONS, getLesson } from "@/lib/guide/lessons";
import { loadLessonProgress } from "@/lib/guide/lessons/progress";
import { createClient, requireProfile } from "@/lib/supabase/server";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

/** 利用者向け：教科書の1レッスン。最後に「できた」を記録できる */
export default async function TraineeGuideLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();

  const profile = await requireProfile();
  const progress = profile.role === "trainee" ? await loadLessonProgress(await createClient(), profile.id) : null;
  const isDone = progress?.available ? progress.doneSlugs.includes(slug) : null;

  return (
    <PageContainer>
      <LessonView lesson={lesson} basePath="/guide" isDone={isDone} />
    </PageContainer>
  );
}
