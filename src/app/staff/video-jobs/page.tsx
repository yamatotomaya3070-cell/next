import { requireRole, createClient } from "@/lib/supabase/server";
import type { VideoJob, VideoJobEvent } from "@/lib/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/states";
import { IconVideo } from "@/components/ui/icons";
import { CreateVideoJobForm } from "./CreateVideoJobForm";
import { VideoJobRow } from "./VideoJobRow";

export const dynamic = "force-dynamic";

export default async function VideoJobsPage() {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const { data: jobsData, error: jobsError } = await supabase
    .from("video_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  const jobs = (jobsData ?? []) as VideoJob[];

  const { data: caseData } = await supabase
    .from("case_knowledge")
    .select("id, title, genre")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: eventsData } = jobs.length
    ? await supabase
        .from("video_job_events")
        .select("*")
        .in("job_id", jobs.map((j) => j.id))
        .order("created_at", { ascending: false })
    : { data: [] };
  const events = (eventsData ?? []) as VideoJobEvent[];
  const eventsByJob = new Map<string, VideoJobEvent[]>();
  for (const e of events) {
    const list = eventsByJob.get(e.job_id) ?? [];
    list.push(e);
    eventsByJob.set(e.job_id, list);
  }

  const signedUrls = new Map<string, string>();
  const paths = jobs
    .flatMap((j) => [j.artifacts?.sample_video, j.artifacts?.assets_zip, j.artifacts?.raw_take_video])
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
      <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
        <IconVideo className="text-primary" />
        AI模擬案件をつくる
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        テーマを入れるだけで、実写映像＋ナレーションの模擬案件（動画・依頼書・手順書・正解データ）を自動生成します。
        取り込んだ実案件のナレッジを学習し、本番に近い水準の練習案件に近づけます。
        台本→音声→実写素材→完成見本→素材パッケージ→案件登録まで工程ごとに進捗を確認できます。
      </p>

      <div className="mt-6">
        <CreateVideoJobForm caseOptions={caseData ?? []} />
      </div>

      <div className="mt-8">
        <SectionCard title={`生成ジョブ一覧（${jobs.length}件）`} icon={<IconVideo />}>
          {jobsError ? (
            <p className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-ink">
              video_jobs テーブルがまだ作成されていません。Supabase の SQL Editor で{" "}
              <code className="rounded bg-page px-1">
                supabase/migrations/00006_video_jobs.sql
              </code>{" "}
              を実行してください。
            </p>
          ) : jobs.length === 0 ? (
            <EmptyState title="ジョブはまだありません" description="上のフォームからテーマを入力して生成を開始してください。" />
          ) : (
            <ul className="space-y-4">
              {jobs.map((job) => (
                <VideoJobRow
                  key={job.id}
                  job={job}
                  events={(eventsByJob.get(job.id) ?? []).slice(0, 20)}
                  videoUrl={job.artifacts?.sample_video ? (signedUrls.get(job.artifacts.sample_video) ?? null) : null}
                  zipUrl={job.artifacts?.assets_zip ? (signedUrls.get(job.artifacts.assets_zip) ?? null) : null}
                  rawTakeUrl={job.artifacts?.raw_take_video ? (signedUrls.get(job.artifacts.raw_take_video) ?? null) : null}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
