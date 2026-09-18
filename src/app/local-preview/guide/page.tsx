import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { GuideIndex } from "@/components/guide/GuideIndex";

/** 開発環境だけ：ログインなしで教科書の目次を確認する */
export default function LocalGuideIndexPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PageContainer>
      <GuideIndex basePath="/local-preview/guide" audience="staff" />
    </PageContainer>
  );
}
