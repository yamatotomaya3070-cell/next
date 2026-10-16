import Link from "next/link";
import { guideHref, guideLabel } from "@/lib/guide/chapters";
import { getOperation, operationHref, type GuideOperation } from "@/lib/guide/operations";
import { IconAlert, IconBook, IconChevronLeft, IconChevronRight, IconSparkles } from "@/components/ui/icons";
import { OpsSearch } from "./OpsSearch";

interface OpViewProps {
  op: GuideOperation;
  basePath: string;
}

function WhereBox({ where }: { where: GuideOperation["where"] }) {
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px] leading-relaxed">
      <dt className="font-bold text-ink-soft">ページ</dt>
      <dd className="text-ink">{where.page}</dd>
      <dt className="font-bold text-ink-soft">場所</dt>
      <dd className="text-ink">{where.panel}</dd>
      {where.button && (
        <>
          <dt className="font-bold text-ink-soft">ボタン</dt>
          <dd className="text-ink">{where.button}</dd>
        </>
      )}
    </dl>
  );
}

/** 操作辞典の1項目。「どこで」「何ができる」「手順」「うまくいかないとき」の順に見せる。 */
export function OpView({ op, basePath }: OpViewProps) {
  const related = (op.related ?? [])
    .map((id) => getOperation(id))
    .filter((r): r is GuideOperation => Boolean(r));
  const chapterLink = op.chapterRef ? guideHref(basePath, op.chapterRef) : null;
  const chapterName = op.chapterRef ? guideLabel(op.chapterRef) : null;

  return (
    <article className="mx-auto w-full max-w-3xl">
      <nav aria-label="もどる" className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href={`${basePath}/ops`} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          <IconChevronLeft className="h-4 w-4" />
          操作辞典の一覧
        </Link>
        <Link href={basePath} className="text-sm font-bold text-primary hover:underline">
          教科書の目次
        </Link>
      </nav>

      <header className="mt-4">
        <p className="text-sm font-bold text-primary">操作辞典</p>
        <h1 className="mt-1 text-2xl font-bold leading-snug text-ink">{op.title}</h1>
        {op.aliases.length > 0 && (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            こんな言い方もします：{op.aliases.slice(0, 8).join("、")}
          </p>
        )}
      </header>

      <section aria-labelledby="op-what" className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 id="op-what" className="text-lg font-bold text-ink">
          これで何ができる？
        </h2>
        <p className="mt-2 text-[17px] leading-relaxed text-ink">{op.what}</p>
      </section>

      <section aria-labelledby="op-where" className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 id="op-where" className="text-lg font-bold text-ink">
          画面のどこでやる？
        </h2>
        <WhereBox where={op.where} />
      </section>

      <section aria-labelledby="op-steps" className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 id="op-steps" className="text-lg font-bold text-ink">
          やり方
        </h2>
        <ol className="mt-3 list-decimal space-y-3 pl-7 text-[18px] leading-relaxed text-ink marker:font-bold marker:text-primary">
          {op.steps.map((step, i) => (
            <li key={i}>
              {step.text}
              {step.hint && (
                <kbd className="ml-2 whitespace-nowrap rounded-md border border-b-2 border-line bg-page px-2 py-0.5 font-mono text-sm text-ink">
                  {step.hint}
                </kbd>
              )}
            </li>
          ))}
        </ol>
        {chapterLink && chapterName && (
          <Link
            href={chapterLink}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 text-base font-bold text-primary hover:bg-primary-soft/70"
          >
            <IconBook className="size-5" />
            写真つきの説明を見る：{chapterName}
          </Link>
        )}
      </section>

      {op.shortcut && (
        <div className="mt-4 flex gap-3 rounded-xl bg-primary-soft/60 p-4 text-[15px] leading-relaxed text-ink">
          <IconSparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            <span className="block font-bold">近道（プリセットがあるとき）</span>
            {op.shortcut}
          </p>
        </div>
      )}

      {op.trouble && op.trouble.length > 0 && (
        <section aria-labelledby="op-trouble" className="mt-4 rounded-xl bg-warning-soft p-5 text-amber-900">
          <h2 id="op-trouble" className="flex items-center gap-2 text-lg font-bold">
            <IconAlert className="h-5 w-5" />
            うまくいかないとき
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-[16px] leading-relaxed">
            {op.trouble.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="op-related" className="mt-8">
          <h2 id="op-related" className="text-lg font-bold text-ink">
            いっしょに使う操作
          </h2>
          <ul className="mt-3 space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={operationHref(basePath, r.id)}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-base font-bold text-ink transition hover:border-primary/40 hover:bg-primary-soft/30"
                >
                  <span className="flex-1">{r.title}</span>
                  <IconChevronRight className="h-5 w-5 shrink-0 text-ink-soft transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <OpsSearch basePath={basePath} compact />
      </div>
    </article>
  );
}
