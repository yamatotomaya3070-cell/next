import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { GuideChapterView } from "@/components/guide/GuideChapterView";
import { LessonView } from "@/components/guide/LessonView";
import { STAFF_CHAPTERS, getStaffChapter } from "@/lib/guide/chapters";
import { LESSONS, getLesson } from "@/lib/guide/lessons";

export function generateStaticParams() {
  return [...LESSONS.map((l) => ({ slug: l.slug })), ...STAFF_CHAPTERS.map((c) => ({ slug: c.slug }))];
}

/** 職員向け：教科書の1レッスン、または職員の方の準備の1章 */
export default async function StaffGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  const chapter = lesson ? undefined : getStaffChapter(slug);
  if (!lesson && !chapter) notFound();

  return (
    <PageContainer>
      {lesson ? <LessonView lesson={lesson} basePath="/staff/guide" /> : <GuideChapterView chapter={chapter!} basePath="/staff/guide" />}
    </PageContainer>
  );
}
