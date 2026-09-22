"use client";

import { useCallback, useState } from "react";
import { IconClipboard } from "@/components/ui/icons";
import { secondaryButtonClass } from "@/components/ui/buttons";

/** レポート1行分（利用者ごとの進捗サマリー）。サーバー側で集計済みの値を受け取る */
export interface ReportRow {
  userName: string;
  transferState: string;
  currentTaskTitle: string;
  currentTaskType: string;
  currentStatus: string;
  progressPercent: number | null;
  aiScore: number | null;
  completedCount: number;
  revisionCount: number;
  onTimeRate: number | null;
  staffCheck: string;
}

const HEADERS = [
  "利用者",
  "移行判定",
  "現在の案件",
  "種別",
  "状況",
  "進捗(%)",
  "AI評価(0-5)",
  "完了件数",
  "修正回数",
  "納期遵守率(%)",
  "スタッフ確認",
] as const;

/** RFC 4180 準拠のセル値エスケープ（カンマ・改行・引用符を含む場合は "" で囲む） */
function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatPercent(value: number | null): string {
  return value === null ? "" : String(Math.round(value));
}

function formatScore(value: number | null): string {
  return value === null ? "" : value.toFixed(1);
}

function buildCsv(rows: ReportRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    const cells = [
      row.userName,
      row.transferState,
      row.currentTaskTitle,
      row.currentTaskType,
      row.currentStatus,
      formatPercent(row.progressPercent),
      formatScore(row.aiScore),
      String(row.completedCount),
      String(row.revisionCount),
      row.onTimeRate === null ? "" : String(Math.round(row.onTimeRate * 100)),
      row.staffCheck,
    ];
    lines.push(cells.map((c) => escapeCell(c)).join(","));
  }
  return lines.join("\r\n");
}

/** YYYYMMDD-HHmm 形式（ファイル名用） */
function fileStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

interface Props {
  rows: ReportRow[];
}

/**
 * 利用者進捗レポートをCSVでダウンロードするボタン。
 * Excelでの日本語文字化けを防ぐため UTF-8 BOM を付与する。
 */
export function ExportReportButton({ rows }: Props) {
  const [done, setDone] = useState(false);

  const handleClick = useCallback(() => {
    const csv = buildCsv(rows);
    // 先頭に UTF-8 BOM (﻿) を付けると Excel が文字化けせず開く
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `利用者進捗レポート_${fileStamp(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  }, [rows]);

  const disabled = rows.length === 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        disabled
          ? "対象の利用者がいません"
          : "利用者の進捗をCSVで書き出します"
      }
      className={`${secondaryButtonClass} w-full text-sm`}
    >
      <IconClipboard className="size-4" />
      {done ? "ダウンロードしました" : "レポートを出力する（CSV）"}
    </button>
  );
}
