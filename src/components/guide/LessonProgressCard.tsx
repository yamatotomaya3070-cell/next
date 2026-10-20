import Link from "next/link";
import { LESSON_STAGES, getLesson, lessonsOfStage } from "@/lib/guide/lessons";
import { LESSON_PROGRESS_MISSING_HINT, summarizeProgress, type LessonProgress } from "@/lib/guide/lessons/progress";
import { ProgressBar } from "@/components/ProgressBar";

/** 職員の画面：利用者の教科書の進み具合（段ごとの数と、次のレッスン） */
export function LessonProgressCard({ progress }: { progress: LessonProgress }) {
  if (!progress.available) return <p className="text-[15px] text-ink-soft">{LESSON_PROGRESS_MISSING_HINT}</p>;
  const done = new Set(progress.doneSlugs);
  const summary = summarizeProgress(progress.doneSlugs);
  const next = summary.nextSlug ? getLesson(summary.nextSlug) : null;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-bold text-ink">
          {summary.done} / {summary.total} レッスンできた
        </p>
        {next ? (
          <Link href={`/staff/guide/${next.slug}`} className="text-[15px] font-bold text-primary hover:underline">
            次は {next.no} {next.title}
          </Link>
        ) : (
          <p className="text-[15px] font-bold text-success">全部終わりました</p>
        )}
      </div>
      <div className="mt-2">
        <ProgressBar percent={Math.round((summary.done / summary.total) * 100)} />
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {LESSON_STAGES.map((s) => {
          const ls = lessonsOfStage(s.stage);
          return (
            <li key={s.stage} className="rounded-xl border border-line p-3">
              <p className="text-xs text-ink-soft">{s.title}</p>
              <p className="mt-0.5 text-lg font-bold text-ink">
                {ls.filter((l) => done.has(l.slug)).length} / {ls.length}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
