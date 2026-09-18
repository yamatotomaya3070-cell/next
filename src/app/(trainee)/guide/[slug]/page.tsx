import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { GuideChapterView } from "@/components/guide/GuideChapterView";
import { GUIDE_CHAPTERS, getGuideChapter } from "@/lib/guide/chapters";

export function generateStaticParams() {
  return GUIDE_CHAPTERS.filter((c) => !c.forStaff).map((c) => ({ slug: c.slug }));
}

/** 利用者向け：教科書の1章。職員向けの章は出さない。 */
export default async function TraineeGuideChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chapter = getGuideChapter(slug);
  if (!chapter || chapter.forStaff) notFound();

  return (
    <PageContainer>
      <GuideChapterView chapter={chapter} basePath="/guide" audience="trainee" />
    </PageContainer>
  );
}
