"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 「今すぐ解析」ボタン。/api/ingests/analyze を叩き、クラウド（Files API）で即時解析する。
 * 解析はワーカー機を必要とせず Vercel 上で完結する。完了後は一覧を再取得する。
 */
export function AnalyzeButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ingests/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || data.ok === false) {
        setError(data.message ?? data.error ?? "解析に失敗しました。");
      } else {
        router.refresh();
      }
    } catch {
      setError("解析リクエストに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-xl border-2 border-primary px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-soft disabled:opacity-50"
      >
        {busy ? "解析中…（クラウドで処理しています）" : "今すぐ解析する"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
