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

/** 受注案件のステータス絞り込み（URLパラメータ連動） */
export function WorksFilter({ current }: { current: AssignmentStatus | null }) {
  return (
    <nav aria-label="ステータスで絞り込む" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = f.value === current;
        return (
          <Link
            key={f.label}
            href={f.value ? `/works?status=${f.value}` : "/works"}
            aria-current={active ? "true" : undefined}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm font-bold transition ${
              active
                ? "border-primary bg-primary text-white"
                : "border-line bg-surface text-ink-soft hover:border-primary/40 hover:text-primary"
            }`}
          >
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}
