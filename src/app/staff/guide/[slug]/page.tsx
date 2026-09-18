import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { GuideChapterView } from "@/components/guide/GuideChapterView";
import { GUIDE_CHAPTERS, getGuideChapter } from "@/lib/guide/chapters";

export function generateStaticParams() {
  return GUIDE_CHAPTERS.map((c) => ({ slug: c.slug }));
}

/** 職員向け：教科書の1章 */
export default async function StaffGuideChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chapter = getGuideChapter(slug);
  if (!chapter) notFound();

  return (
    <PageContainer>
      <GuideChapterView chapter={chapter} basePath="/staff/guide" audience="staff" />
    </PageContainer>
  );
}
