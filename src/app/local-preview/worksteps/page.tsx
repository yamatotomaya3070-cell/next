import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { WorkSteps } from "@/components/work/WorkSteps";
import { getWorkSteps } from "@/lib/guide/workflow";

/** 開発環境だけ：ログインなしで「作業のしかた」の見た目を確認する */
export default function LocalWorkStepsPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PageContainer>
      <WorkSteps
        steps={getWorkSteps("/local-preview/guide")}
        assignmentId="preview"
        guideTopHref="/local-preview/guide"
      />
    </PageContainer>
  );
}
