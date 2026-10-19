import Image from "next/image";
import Link from "next/link";
import { GUIDE_CHAPTERS, type GuideChapter, type GuideExample, type GuideSection } from "@/lib/guide/chapters";
import { getOperation, operationHref, type GuideOperation } from "@/lib/guide/operations";
import { IconAlert, IconBook, IconChevronLeft, IconChevronRight, IconDownload, IconHelp } from "@/components/ui/icons";

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

/** 節の下に出す「操作辞典で見る」リンク */
function OpLinks({ ids, basePath }: { ids: string[]; basePath: string }) {
  const ops = ids.map((id) => getOperation(id)).filter((op): op is GuideOperation => Boolean(op));
  if (ops.length === 0) return null;
  return (
    <div className="mt-5 rounded-xl border border-line bg-page p-4">
      <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
        <IconBook className="size-5 text-primary" />
        くわしい操作を辞典で見る
      </p>
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
    </div>
  );
}

/** 「直す前 → 直した後」の例 */
function Examples({ examples }: { examples: GuideExample[] }) {
  return (
    <div className="mt-5 space-y-4">
      <p className="text-[15px] font-bold text-ink">例</p>
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
  );
}

function SectionBlock({ section, basePath }: { section: GuideSection; basePath: string }) {
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

      {section.examples && section.examples.length > 0 && <Examples examples={section.examples} />}

      {section.download && (
        <a
          href={section.download.href}
          download
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-white shadow-sm transition hover:bg-primary-dark"
        >
          <IconDownload className="size-5" />
          {section.download.label}
          <span className="text-sm font-normal text-white/80">（ZIP・{section.download.size}）</span>
        </a>
      )}

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

      {section.ops && <OpLinks ids={section.ops} basePath={basePath} />}
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
        <Link
          href={`${basePath}/ops`}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-base font-bold text-primary hover:underline"
        >
          <IconBook className="h-5 w-5" />
          分からない言葉は操作辞典で調べる
        </Link>
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
          <SectionBlock key={s.id} section={s} basePath={basePath} />
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
