"use client";

import { usePathname } from "next/navigation";

interface HeaderTitleProps {
  /** pathname の前方一致 → 画面名 */
  titleMap: Record<string, string>;
}

/** 現在のパスから画面名を表示する（ヘッダー用） */
export function HeaderTitle({ titleMap }: HeaderTitleProps) {
  const pathname = usePathname();
  const entry = Object.entries(titleMap)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!entry) return null;
  return (
    <span className="hidden truncate text-xl font-bold text-ink md:block">
      {entry[1]}
    </span>
  );
}
