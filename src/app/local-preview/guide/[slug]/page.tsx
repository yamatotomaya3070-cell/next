import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { GuideChapterView } from "@/components/guide/GuideChapterView";
import { getGuideChapter } from "@/lib/guide/chapters";

/** 開発環境だけ：ログインなしで教科書の章を確認する */
export default async function LocalGuidePreview({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { slug } = await params;
  const chapter = getGuideChapter(slug);
  if (!chapter) notFound();
  return (
    <PageContainer>
      <GuideChapterView chapter={chapter} basePath="/local-preview/guide" audience="staff" />
    </PageContainer>
  );
}
