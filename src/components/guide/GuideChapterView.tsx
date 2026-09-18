import Image from "next/image";
import Link from "next/link";
import { GUIDE_CHAPTERS, type GuideChapter, type GuideSection } from "@/lib/guide/chapters";
import { IconAlert, IconChevronLeft, IconChevronRight, IconHelp } from "@/components/ui/icons";

interface GuideChapterViewProps {
  chapter: GuideChapter;
  basePath: string;
  audience: "trainee" | "staff";
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

function SectionBlock({ section }: { section: GuideSection }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-h`} className="scroll-mt-6 border-t border-line pt-8">
      <h2 id={`${section.id}-h`} className="text-xl font-bold text-ink">
        {section.title}
      </h2>
      {section.lead && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{section.lead}</p>}

      <ol className="mt-4 list-decimal space-y-2 pl-6 text-[17px] leading-relaxed text-ink marker:font-bold marker:text-ink-soft">
        {section.steps.map((step, i) => (
          <li key={i}>
            {step.text}
            {step.hint && (
              <kbd className="ml-2 whitespace-nowrap rounded-md border border-b-2 border-line bg-surface px-2 py-0.5 font-mono text-sm text-ink">
                {step.hint}
              </kbd>
            )}
          </li>
        ))}
      </ol>

      {section.image && (
        <figure className="mt-5">
          <Image
            src={section.image.src}
            alt={section.image.alt}
            width={1280}
            height={752}
            sizes="(min-width: 1024px) 896px, 100vw"
            className="h-auto w-full rounded-xl border border-line bg-black shadow-sm"
          />
          {section.image.marks && section.image.marks.length > 0 && (
            <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
              {section.image.marks.map((m) => (
                <span key={m.n}>
                  <Mark n={m.n} />
                  {m.label}
                </span>
              ))}
            </figcaption>
          )}
        </figure>
      )}

      {section.note && (
        <div
          className={`mt-5 flex gap-3 rounded-xl p-4 text-[15px] leading-relaxed ${
            section.note.kind === "warn" ? "bg-red-50 text-red-900" : "bg-warning-soft text-amber-900"
          }`}
        >
          {section.note.kind === "warn" ? (
            <IconAlert className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <IconHelp className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p>
            <span className="block font-bold">{section.note.title}</span>
            {section.note.body}
          </p>
        </div>
      )}
    </section>
  );
}

/** 教科書の1章。利用者・職員の両方のページから使う。 */
export function GuideChapterView({ chapter, basePath, audience }: GuideChapterViewProps) {
  const visible = GUIDE_CHAPTERS.filter((c) => audience === "staff" || !c.forStaff);
  const idx = visible.findIndex((c) => c.slug === chapter.slug);
  const prev = idx > 0 ? visible[idx - 1] : null;
  const next = idx >= 0 && idx < visible.length - 1 ? visible[idx + 1] : null;

  return (
    <article className="mx-auto w-full max-w-4xl">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        教科書の目次
      </Link>

      <header className="mt-4">
        <p className="text-sm font-bold text-primary">第{chapter.no}章</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{chapter.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{chapter.summary}</p>
      </header>

      {chapter.sections.length > 1 && (
        <nav aria-label="この章の中身" className="mt-5 rounded-xl bg-page p-4">
          <ol className="flex flex-wrap gap-2">
            {chapter.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:border-primary/40"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {chapter.video && (
        <div className="mt-6">
          <video
            controls
            preload="metadata"
            poster={chapter.video.poster}
            className="aspect-video w-full rounded-xl border border-line bg-black"
          >
            <source src={chapter.video.src} type="video/mp4" />
          </video>
          <p className="mt-2 text-sm text-ink-soft">声で説明しながら、実際に操作している動画です。</p>
        </div>
      )}

      <div className="mt-8 space-y-10">
        {chapter.sections.map((s) => (
          <SectionBlock key={s.id} section={s} />
        ))}
      </div>

      <nav aria-label="前後の章" className="mt-12 grid grid-cols-1 gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`${basePath}/${prev.slug}`} className="rounded-xl border border-line bg-surface p-4 hover:bg-page">
            <span className="flex items-center gap-1 text-sm text-ink-soft">
              <IconChevronLeft className="h-4 w-4" />
              前の章
            </span>
            <span className="mt-1 block font-bold text-ink">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`${basePath}/${next.slug}`} className="rounded-xl border border-line bg-surface p-4 text-right hover:bg-page">
            <span className="flex items-center justify-end gap-1 text-sm text-ink-soft">
              次の章
              <IconChevronRight className="h-4 w-4" />
            </span>
            <span className="mt-1 block font-bold text-ink">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
