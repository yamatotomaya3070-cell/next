import Image from "next/image";
import Link from "next/link";
import { LESSON_STAGES, PRACTICE_KITS, neighborLessons, type GuideExample, type Lesson, type LessonImage, type LessonPart } from "@/lib/guide/lessons";
import { getOperation, operationHref, type GuideOperation } from "@/lib/guide/operations";
import { LessonDoneButton } from "./LessonDoneButton";
import { PracticeCheck } from "./PracticeCheck";
import { IconAlert, IconBook, IconCheckCircle, IconDownload, IconChevronLeft, IconChevronRight } from "@/components/ui/icons";

interface LessonViewProps {
  lesson: Lesson;
  basePath: string;
  /** 利用者のとき、このレッスンを「できた」にしてあるか。null は記録しない（職員・準備前） */
  isDone?: boolean | null;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-2 whitespace-nowrap rounded-md border border-b-2 border-line bg-surface px-2 py-0.5 font-mono text-sm text-ink">
      {children}
    </kbd>
  );
}

function Mark({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E0362B] align-[0.1em] text-xs font-bold text-white"
    >
      {n}
    </span>
  );
}

function StepImage({ image }: { image: LessonImage }) {
  return (
    <figure className="mt-3">
      <Image
        src={image.src}
        alt={image.alt}
        width={1280}
        height={752}
        sizes="(min-width: 1024px) 832px, 100vw"
        className="h-auto w-full rounded-xl border border-line bg-black shadow-sm"
      />
      {image.marks && image.marks.length > 0 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {image.marks.map((m) => (
            <span key={m.n}>
              <Mark n={m.n} />
              {m.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

function PartBlock({ part, index }: { part: LessonPart; index: number }) {
  const id = `part-${index + 1}`;
  return (
    <section aria-labelledby={id} className="border-t border-line pt-6">
      <h2 id={id} className="text-xl font-bold text-ink">
        {part.title}
      </h2>
      {part.lead && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{part.lead}</p>}
      <ol className="mt-4 list-decimal space-y-4 pl-7 text-[17px] leading-relaxed text-ink marker:font-bold marker:text-primary">
        {part.steps.map((step, i) => (
          <li key={i}>
            {step.text}
            {step.key && <Kbd>{step.key}</Kbd>}
            {step.mac && (
              <span className="mt-1 block text-[15px] text-ink-soft">
                <span className="mr-1 rounded bg-page px-1.5 py-0.5 text-xs font-bold text-ink">Mac のとき</span>
                {step.mac}
              </span>
            )}
            {step.image && <StepImage image={step.image} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Examples({ examples }: { examples: GuideExample[] }) {
  return (
    <section aria-labelledby="lesson-examples" className="border-t border-line pt-6">
      <h2 id="lesson-examples" className="text-xl font-bold text-ink">
        例
      </h2>
      <div className="mt-4 space-y-4">
        {examples.map((ex, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs font-bold text-red-800">直す前</p>
                <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed text-red-950">{ex.before}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs font-bold text-emerald-800">直した後</p>
                <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed text-emerald-950">{ex.after}</p>
              </div>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              <span className="font-bold text-ink">なぜ：</span>
              {ex.why}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OpLinks({ ids, basePath }: { ids: string[]; basePath: string }) {
  const ops = ids.map((id) => getOperation(id)).filter((op): op is GuideOperation => Boolean(op));
  if (ops.length === 0) return null;
  return (
    <section aria-labelledby="lesson-ops" className="rounded-xl border border-line bg-page p-4">
      <h2 id="lesson-ops" className="flex items-center gap-2 text-[15px] font-bold text-ink">
        <IconBook className="size-5 text-primary" />
        操作をもっとくわしく（操作辞典）
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {ops.map((op) => (
          <li key={op.id}>
            <Link
              href={operationHref(basePath, op.id)}
              className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-[15px] text-primary hover:border-primary/40 hover:bg-primary-soft/30"
            >
              {op.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 教科書の1レッスン。上から「できるようになること → 言葉 → 手順 → 目安 → 例 → つまずき → 確かめる」の順。 */
export function LessonView({ lesson, basePath, isDone = null }: LessonViewProps) {
  const { prev, next } = neighborLessons(lesson.slug);
  const stage = LESSON_STAGES.find((s) => s.stage === lesson.stage);
  const kit = lesson.kit ? PRACTICE_KITS[lesson.kit] : null;

  return (
    <article className="mx-auto w-full max-w-4xl">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        教科書の目次
      </Link>

      <header className="mt-4">
        <p className="text-sm font-bold text-primary">
          {stage?.title}　レッスン {lesson.no}
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-snug text-ink">{lesson.title}</h1>
        <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-primary-soft/40 p-4">
          <p className="text-sm font-bold text-primary">この練習でできるようになること</p>
          <p className="mt-1 text-[17px] font-bold leading-relaxed text-ink">{lesson.goal}</p>
          <p className="mt-2 text-sm text-ink-soft">
            目安 {lesson.minutes}分{lesson.material ? `　／　使う素材：${lesson.material}` : ""}
          </p>
          {kit && (
            <a
              href={kit.href}
              download
              className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-white shadow-sm transition hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconDownload className="size-5" />
              練習の素材をダウンロード
              <span className="text-sm font-normal text-white/80">（ZIP・{kit.size}）</span>
            </a>
          )}
        </div>
      </header>

      {lesson.words && lesson.words.length > 0 && (
        <section aria-labelledby="lesson-words" className="mt-6">
          <h2 id="lesson-words" className="text-base font-bold text-ink-soft">
            このレッスンで出てくる言葉
          </h2>
          <dl className="mt-2 grid gap-2">
            {lesson.words.map((w) => (
              <div key={w.term} className="rounded-xl bg-page p-3 text-[15px] leading-relaxed">
                <dt className="inline font-bold text-ink">{w.term}</dt>
                <dd className="inline text-ink">：{w.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-8 space-y-8">
        {lesson.parts.map((part, i) => (
          <PartBlock key={part.title} part={part} index={i} />
        ))}

        {lesson.rules && lesson.rules.length > 0 && (
          <section aria-labelledby="lesson-rules" className="border-t border-line pt-6">
            <h2 id="lesson-rules" className="text-xl font-bold text-ink">
              目安
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-[17px] leading-relaxed text-ink">
              {lesson.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {lesson.examples && lesson.examples.length > 0 && <Examples examples={lesson.examples} />}

        {lesson.pitfalls && lesson.pitfalls.length > 0 && (
          <section aria-labelledby="lesson-pitfalls" className="space-y-3 border-t border-line pt-6">
            <h2 id="lesson-pitfalls" className="text-xl font-bold text-ink">
              つまずきやすい所
            </h2>
            {lesson.pitfalls.map((p) => (
              <div key={p.title} className="flex gap-3 rounded-xl bg-warning-soft p-4 text-[15px] leading-relaxed text-amber-900">
                <IconAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  <span className="block font-bold">{p.title}</span>
                  {p.body}
                </p>
              </div>
            ))}
          </section>
        )}

        {lesson.autoCheck && <PracticeCheck key={lesson.slug} checkId={lesson.autoCheck} />}

        <section aria-labelledby="lesson-checks" className="rounded-2xl border-2 border-success/30 bg-success-soft/40 p-5">
          <h2 id="lesson-checks" className="text-xl font-bold text-ink">
            できたか確かめる
          </h2>
          <ul className="mt-3 space-y-2 text-[17px] leading-relaxed text-ink">
            {lesson.checks.map((c) => (
              <li key={c} className="flex gap-2">
                <IconCheckCircle className="mt-1 h-5 w-5 shrink-0 text-success" />
                {c}
              </li>
            ))}
          </ul>
          {isDone !== null && <LessonDoneButton slug={lesson.slug} initialDone={isDone} />}
        </section>

        {lesson.ops && <OpLinks ids={lesson.ops} basePath={basePath} />}
      </div>

      <nav aria-label="前後のレッスン" className="mt-12 grid grid-cols-1 gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`${basePath}/${prev.slug}`} className="rounded-xl border border-line bg-surface p-4 hover:bg-page">
            <span className="flex items-center gap-1 text-sm text-ink-soft">
              <IconChevronLeft className="h-4 w-4" />
              前のレッスン
            </span>
            <span className="mt-1 block font-bold text-ink">
              {prev.no} {prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`${basePath}/${next.slug}`} className="rounded-xl border border-line bg-surface p-4 text-right hover:bg-page">
            <span className="flex items-center justify-end gap-1 text-sm text-ink-soft">
              次のレッスン
              <IconChevronRight className="h-4 w-4" />
            </span>
            <span className="mt-1 block font-bold text-ink">
              {next.no} {next.title}
            </span>
          </Link>
        )}
      </nav>
    </article>
  );
}
