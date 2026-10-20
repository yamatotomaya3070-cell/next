import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { GuideChapterView } from "@/components/guide/GuideChapterView";
import { LessonView } from "@/components/guide/LessonView";
import { getStaffChapter } from "@/lib/guide/chapters";
import { getLesson } from "@/lib/guide/lessons";

/** 開発環境だけ：ログインなしで教科書のレッスン・職員の章を確認する */
export default async function LocalGuidePreview({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { slug } = await params;
  const lesson = getLesson(slug);
  const chapter = lesson ? undefined : getStaffChapter(slug);
  if (!lesson && !chapter) notFound();
  return (
    <PageContainer>
      {lesson ? (
        <LessonView lesson={lesson} basePath="/local-preview/guide" />
      ) : (
        <GuideChapterView chapter={chapter!} basePath="/local-preview/guide" />
      )}
    </PageContainer>
  );
}
