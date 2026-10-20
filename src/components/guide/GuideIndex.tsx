import Link from "next/link";
import { STAFF_CHAPTERS } from "@/lib/guide/chapters";
import { LESSON_STAGES, getLesson, lessonsOfStage, type Lesson } from "@/lib/guide/lessons";
import { summarizeProgress, type LessonProgress } from "@/lib/guide/lessons/progress";
import { IconBook, IconCheckCircle, IconChevronRight } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ProgressBar";
import { OpsSearch } from "./OpsSearch";

interface GuideIndexProps {
  /** "/guide"（利用者）または "/staff/guide"（職員） */
  basePath: string;
  audience: "trainee" | "staff";
  /** 利用者の進み具合（職員の画面では渡さない） */
  progress?: LessonProgress;
}

function LessonRow({ lesson, basePath, isDone, isNext }: { lesson: Lesson; basePath: string; isDone: boolean; isNext: boolean }) {
  return (
    <li>
      <Link
        href={`${basePath}/${lesson.slug}`}
        className={`group flex items-start gap-4 rounded-2xl border bg-surface p-4 transition ${isNext ? "border-primary/60 ring-2 ring-primary/20" : "border-line"} ${isDone ? "opacity-75" : ""} hover:border-primary/40 hover:bg-primary-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
      >
        <span className="flex h-10 min-w-12 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-base font-bold text-white tabular-nums">
          {lesson.no}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-ink">{lesson.title}</span>
            {isDone && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
                <IconCheckCircle className="size-3.5" />
                できた
              </span>
            )}
            {isNext && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">次はここ</span>}
          </span>
          <span className="mt-1 block text-[15px] leading-relaxed text-ink-soft">{lesson.goal}</span>
          <span className="mt-1 block text-sm text-ink-soft">目安 {lesson.minutes}分</span>
        </span>
        <IconChevronRight className="mt-2 h-5 w-5 shrink-0 text-ink-soft transition group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

/** 教科書の目次。段0から順に、上からやれば案件を受けられるところまで行く。職員の準備は職員の画面にだけ出す。 */
export function GuideIndex({ basePath, audience, progress }: GuideIndexProps) {
  const done = new Set(progress?.available ? progress.doneSlugs : []);
  const summary = progress?.available ? summarizeProgress(progress.doneSlugs) : null;
  const next = summary?.nextSlug ? getLesson(summary.nextSlug) : null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">動画編集の教科書</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        はじめての人が、上から順にやれば、動画編集のお仕事を受けて納品できるようになる順番に並んでいます。1つのレッスンは15〜30分です。
      </p>

      {summary && (
        <section aria-labelledby="guide-progress" className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="guide-progress" className="text-base font-bold text-ink">
              あなたの進み具合
            </h2>
            <span className="text-[15px] font-bold text-ink">
              {summary.done} / {summary.total} できた
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar percent={Math.round((summary.done / summary.total) * 100)} />
          </div>
          {next ? (
            <Link
              href={`${basePath}/${next.slug}`}
              className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-white shadow-sm transition hover:bg-primary-dark"
            >
              次は {next.no} {next.title}
              <IconChevronRight className="size-5" />
            </Link>
          ) : (
            <p className="mt-3 text-[15px] font-bold text-success">全部のレッスンが終わりました。</p>
          )}
        </section>
      )}

      <div className="mt-6">
        <OpsSearch basePath={basePath} />
      </div>
      <Link
        href={`${basePath}/ops`}
        className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-base font-bold text-primary transition hover:border-primary/40 hover:bg-primary-soft/30"
      >
        <IconBook className="size-5" />
        操作辞典の一覧を見る（画面の部分ごと）
        <IconChevronRight className="size-4" />
      </Link>

      {audience === "staff" && (
        <section className="mt-8" aria-labelledby="guide-staff">
          <h2 id="guide-staff" className="text-base font-bold text-ink-soft">
            職員の方の準備
          </h2>
          <ol className="mt-3 space-y-3">
            {STAFF_CHAPTERS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`${basePath}/${c.slug}`}
                  className="group flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-primary/40 hover:bg-primary-soft/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-ink">{c.title}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-ink-soft">{c.summary}</span>
                  </span>
                  <IconChevronRight className="mt-2 h-5 w-5 shrink-0 text-ink-soft" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {LESSON_STAGES.map((s) => (
        <section key={s.stage} className="mt-10" aria-labelledby={`stage-${s.stage}`}>
          <h2 id={`stage-${s.stage}`} className="text-xl font-bold text-ink">
            {s.title}
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{s.summary}</p>
          <ol className="mt-3 space-y-3">
            {lessonsOfStage(s.stage).map((l) => (
              <LessonRow key={l.slug} lesson={l} basePath={basePath} isDone={done.has(l.slug)} isNext={summary?.nextSlug === l.slug} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
