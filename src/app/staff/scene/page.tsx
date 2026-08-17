import { requireRole, createClient } from "@/lib/supabase/server";
import type { SceneJob, SceneGenerationNote } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/states";
import { IconVideo } from "@/components/ui/icons";
import { CreateSceneJobForm } from "./CreateSceneJobForm";
import { SceneJobRow } from "./SceneJobRow";
import { AddSceneNoteForm } from "./AddSceneNoteForm";

export const dynamic = "force-dynamic";

export default async function SceneJobsPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const { data: jobsData } = await supabase
    .from("scene_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  const jobs = (jobsData ?? []) as SceneJob[];

  const { data: notesData } = await supabase
    .from("scene_generation_notes")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  const notes = (notesData ?? []) as SceneGenerationNote[];

  const signedUrls = new Map<string, string>();
  const paths = jobs
    .flatMap((j) => [j.artifacts?.sample_video, j.artifacts?.assets_zip])
    .filter(Boolean) as string[];
  if (paths.length > 0) {
    await Promise.all(
      paths.map(async (path) => {
        const { data } = await supabase.storage.from("materials").createSignedUrl(path, 60 * 60);
        if (data?.signedUrl) signedUrls.set(path, data.signedUrl);
      }),
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          テーマを入れるだけで、ハル・ミナ先生が会話で解説する完成見本と、就労者がDaVinciで編集する
          素材一式・手順書・依頼書を自動生成し、案件として登録します。
        </p>
        <SectionCard title="新しく作る">
          <CreateSceneJobForm />
        </SectionCard>

        <SectionCard title="生成ジョブ">
          {jobs.length === 0 ? (
            <EmptyState
              icon={<IconVideo className="size-6" />}
              title="まだ生成ジョブがありません"
              description="上でテーマを入れて「この内容で案件を作る」を押すと、ここに並びます。"
            />
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <SceneJobRow
                  key={job.id}
                  job={job}
                  sampleUrl={job.artifacts?.sample_video ? signedUrls.get(job.artifacts.sample_video) : undefined}
                  assetsUrl={job.artifacts?.assets_zip ? signedUrls.get(job.artifacts.assets_zip) : undefined}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={`生成ナレッジ（AIが次から気をつける点）${notes.length ? `・${notes.length}件` : ""}`}>
          <div className="space-y-4">
            <AddSceneNoteForm />
            {notes.length > 0 && (
              <ul className="space-y-1.5 text-sm text-ink-soft">
                {notes.map((n) => (
                  <li key={n.id} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{n.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
