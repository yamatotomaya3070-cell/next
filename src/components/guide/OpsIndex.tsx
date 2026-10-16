import Link from "next/link";
import { OP_CATEGORIES, getOperationsByCategory, operationHref } from "@/lib/guide/operations";
import { IconChevronLeft } from "@/components/ui/icons";
import { OpsSearch } from "./OpsSearch";

interface OpsIndexProps {
  basePath: string;
}

/** 操作辞典の一覧。画面の部分ごとに、操作の名前だけを並べる。 */
export function OpsIndex({ basePath }: OpsIndexProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        教科書の目次
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">操作辞典</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        DaVinci Resolve の操作を、1つずつ説明しています。依頼書に分からない言葉があったら、下の検索窓に入れてください。
      </p>

      <div className="mt-6">
        <OpsSearch basePath={basePath} />
      </div>

      <nav aria-label="画面の部分ごとの目次" className="mt-8 rounded-xl bg-page p-4">
        <ul className="flex flex-wrap gap-2">
          {OP_CATEGORIES.map((c) => (
            <li key={c.id}>
              <a
                href={`#cat-${c.id}`}
                className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:border-primary/40"
              >
                {c.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 space-y-10">
        {OP_CATEGORIES.map((c) => {
          const ops = getOperationsByCategory(c.id);
          if (ops.length === 0) return null;
          return (
            <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`cat-${c.id}-h`} className="scroll-mt-6">
              <h2 id={`cat-${c.id}-h`} className="text-xl font-bold text-ink">
                {c.title}
              </h2>
              <p className="mt-1 text-[15px] text-ink-soft">{c.summary}</p>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ops.map((op) => (
                  <li key={op.id}>
                    <Link
                      href={operationHref(basePath, op.id)}
                      className="block h-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-bold text-ink transition hover:border-primary/40 hover:bg-primary-soft/30"
                    >
                      {op.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
