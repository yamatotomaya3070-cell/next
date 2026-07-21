import type { ReactNode } from "react";
import { EmptyState } from "./states";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
}

/** 共通テーブル。横幅が足りない場合はテーブル側だけ横スクロールする。 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "データがありません",
  emptyDescription,
  caption,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line text-sm text-ink-soft">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 font-medium ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition hover:bg-page/60">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3.5 ${col.className ?? ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
