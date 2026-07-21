"use client";

import { useEffect, useState } from "react";

interface BreakReminderProps {
  intervalMinutes: number;
}

/** 一定時間ごとに休憩をやさしく促すバナー */
export function BreakReminder({ intervalMinutes }: BreakReminderProps) {
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    const timer = setInterval(
      () => setShowReminder(true),
      intervalMinutes * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, [intervalMinutes]);

  if (!showReminder) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-2xl border-2 border-success/30 bg-success-soft p-5 shadow-xl"
    >
      <p className="text-lg font-bold text-ink">☕ 休憩しませんか?</p>
      <p className="mt-1 text-success">
        {intervalMinutes}分たちました。少し休むと、作業がはかどります。
      </p>
      <button
        type="button"
        onClick={() => setShowReminder(false)}
        className="mt-3 min-h-11 w-full rounded-xl bg-success px-4 py-2 font-bold text-white transition hover:bg-success/90"
      >
        わかりました
      </button>
    </div>
  );
}
