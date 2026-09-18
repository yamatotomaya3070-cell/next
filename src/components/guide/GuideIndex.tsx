import Link from "next/link";
import { GUIDE_CHAPTERS, type GuideChapter } from "@/lib/guide/chapters";
import { IconChevronRight, IconPlayCircle } from "@/components/ui/icons";

interface GuideIndexProps {
  /** "/guide"（利用者）または "/staff/guide"（職員） */
  basePath: string;
  audience: "trainee" | "staff";
}

function ChapterRow({ chapter, basePath }: { chapter: GuideChapter; basePath: string }) {
  return (
    <li>
      <Link
        href={`${basePath}/${chapter.slug}`}
        className="group flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-primary/40 hover:bg-primary-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white tabular-nums">
          {chapter.no}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-ink">{chapter.title}</span>
            {chapter.video && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                <IconPlayCircle className="h-3.5 w-3.5" />
                動画あり
              </span>
            )}
          </span>
          <span className="mt-1 block text-[15px] leading-relaxed text-ink-soft">{chapter.summary}</span>
        </span>
        <IconChevronRight className="mt-2 h-5 w-5 shrink-0 text-ink-soft transition group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

/** 教科書の目次。利用者には職員向けの章を出さない。 */
export function GuideIndex({ basePath, audience }: GuideIndexProps) {
  const learner = GUIDE_CHAPTERS.filter((c) => !c.forStaff);
  const staffOnly = GUIDE_CHAPTERS.filter((c) => c.forStaff);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">動画編集の教科書</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        DaVinci Resolve の操作を、実際の画面の写真で説明しています。どの動画を作るときも同じ操作なので、手順書で分からないところがあったら、ここを開いてください。
      </p>

      {audience === "staff" && staffOnly.length > 0 && (
        <section className="mt-8" aria-labelledby="guide-staff">
          <h2 id="guide-staff" className="text-base font-bold text-ink-soft">
            職員の方の準備
          </h2>
          <ol className="mt-3 space-y-3">
            {staffOnly.map((c) => (
              <ChapterRow key={c.slug} chapter={c} basePath={basePath} />
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8" aria-labelledby="guide-learn">
        <h2 id="guide-learn" className="text-base font-bold text-ink-soft">
          編集の操作
        </h2>
        <ol className="mt-3 space-y-3">
          {learner.map((c) => (
            <ChapterRow key={c.slug} chapter={c} basePath={basePath} />
          ))}
        </ol>
      </section>
    </div>
  );
}
