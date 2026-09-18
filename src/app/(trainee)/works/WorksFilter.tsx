import Link from "next/link";
import type { AssignmentStatus } from "@/lib/types";

const FILTERS: { value: AssignmentStatus | null; label: string }[] = [
  { value: null, label: "すべて" },
  { value: "not_started", label: "未着手" },
  { value: "in_progress", label: "作業中" },
  { value: "submitted", label: "レビュー待ち" },
  { value: "feedback", label: "修正依頼" },
  { value: "completed", label: "完了" },
];

interface WorksFilterProps {
  current: AssignmentStatus | null;
  /** 状態ごとの件数（メニューを1本にまとめた分、ここで全体像がわかるようにする） */
  counts: Record<AssignmentStatus, number>;
}

/** 受注案件のステータス絞り込み（URLパラメータ連動・件数つき） */
export function WorksFilter({ current, counts }: WorksFilterProps) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return (
    <nav aria-label="ステータスで絞り込む" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = f.value === current;
        const count = f.value ? counts[f.value] : total;
        return (
          <Link
            key={f.label}
            href={f.value ? `/works?status=${f.value}` : "/works"}
            aria-current={active ? "true" : undefined}
            className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition ${
              active
                ? "border-primary bg-primary text-white"
                : "border-line bg-surface text-ink-soft hover:border-primary/40 hover:text-primary"
            }`}
          >
            {f.label}
            <span
              className={`rounded-full px-1.5 text-xs ${
                active ? "bg-white/25 text-white" : "bg-page text-ink-soft"
              }`}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
