"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { GUIDE_OPERATIONS, POPULAR_SEARCH_WORDS, operationHref } from "@/lib/guide/operations";
import { searchOperations } from "@/lib/guide/opsSearch";
import { IconChevronRight, IconSearch } from "@/components/ui/icons";

interface OpsSearchProps {
  /** "/guide"（利用者）・"/staff/guide"（職員）など */
  basePath: string;
  /** 見出しを出すか（操作のページの上では小さく出す） */
  compact?: boolean;
}

/** 一度に見せる結果の数。障害のある利用者が迷わないように少なめにする */
const MAX_RESULTS = 8;

/** 操作辞典の検索窓。入れたそばから結果が出る。 */
export function OpsSearch({ basePath, compact = false }: OpsSearchProps) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const hits = useMemo(() => searchOperations(GUIDE_OPERATIONS, query, MAX_RESULTS), [query]);
  const hasQuery = query.trim().length > 0;

  return (
    <section
      role="search"
      aria-label="操作辞典の検索"
      className="rounded-2xl border border-line bg-surface p-5 shadow-card"
    >
      <label htmlFor={inputId} className={`block font-bold text-ink ${compact ? "text-base" : "text-xl"}`}>
        分からない言葉で調べる
      </label>
      {!compact && (
        <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
          依頼書に書いてある言葉を、そのまま入れても大丈夫です（例：「フェードしてください」）。
        </p>
      )}
      <div className="relative mt-3">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-ink-soft" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例：カット、テロップ、音量"
          autoComplete="off"
          className="min-h-14 w-full rounded-xl border-2 border-line bg-page py-3 pl-12 pr-4 text-lg text-ink placeholder:text-ink-soft/70 focus:border-primary focus:bg-surface"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">よく調べる言葉：</span>
        {POPULAR_SEARCH_WORDS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setQuery(w)}
            className="min-h-10 rounded-full border border-line bg-surface px-4 text-base text-ink transition hover:border-primary/40 hover:bg-primary-soft/40"
          >
            {w}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-4">
        {hasQuery && hits.length === 0 && (
          <p className="rounded-xl bg-warning-soft p-4 text-base leading-relaxed text-amber-900">
            見つかりませんでした。短い言葉にするか、ちがう言い方で入れてみてください（例：「切る」→「カット」）。それでも見つからないときは、職員の方に聞いてください。
          </p>
        )}
        {hits.length > 0 && (
          <>
            <p className="text-sm text-ink-soft">{hits.length}件 見つかりました</p>
            <ul className="mt-2 space-y-2">
              {hits.map(({ op }) => (
                <li key={op.id}>
                  <Link
                    href={operationHref(basePath, op.id)}
                    className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-primary/40 hover:bg-primary-soft/30"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold text-ink">{op.title}</span>
                      <span className="mt-0.5 block text-[15px] text-ink-soft">
                        {op.where.page}／{op.where.panel}
                      </span>
                    </span>
                    <IconChevronRight className="h-5 w-5 shrink-0 text-ink-soft transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
