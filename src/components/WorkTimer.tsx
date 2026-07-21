"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logProgress } from "@/lib/actions/assignments";

interface WorkTimerProps {
  assignmentId: string;
  estimatedMinutes: number | null;
  alreadyStarted: boolean;
}

const storageKey = (id: string) => `work-minutes:${id}`;

/** 作業時間タイマー。開始/休憩を記録し、経過分数を localStorage に保持 */
export function WorkTimer({
  assignmentId,
  estimatedMinutes,
  alreadyStarted,
}: WorkTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  // 保存済みの作業時間を復元（SSR中は0）
  const [seconds, setSeconds] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(storageKey(assignmentId)) ?? 0) * 60;
  });
  const [hasStarted, setHasStarted] = useState(alreadyStarted);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 経過分数を保存
  useEffect(() => {
    localStorage.setItem(
      storageKey(assignmentId),
      String(Math.floor(seconds / 60)),
    );
  }, [seconds, assignmentId]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStart = useCallback(async () => {
    setIsRunning(true);
    const event = hasStarted ? "resume" : "start";
    setHasStarted(true);
    await logProgress(assignmentId, event);
  }, [assignmentId, hasStarted]);

  const handlePause = useCallback(async () => {
    setIsRunning(false);
    await logProgress(assignmentId, "break", {
      minutesDelta: Math.floor(seconds / 60),
    });
  }, [assignmentId, seconds]);

  const mins = Math.floor(seconds / 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const ss = seconds % 60;

  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-ink-soft">作業時間</p>
          <p
            className="font-mono text-3xl font-bold text-ink"
            aria-live="polite"
            suppressHydrationWarning
          >
            {hh > 0 ? `${hh}:` : ""}
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </p>
          {estimatedMinutes && (
            <p className="mt-1 text-sm text-ink-soft">
              目安: 約{estimatedMinutes}分
            </p>
          )}
        </div>
        {isRunning ? (
          <button
            type="button"
            onClick={handlePause}
            className="min-h-14 rounded-2xl border-2 border-warning/40 bg-warning-soft px-6 text-lg font-bold text-amber-800 transition hover:bg-warning-soft"
          >
            ⏸ 休憩する
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="min-h-14 rounded-2xl bg-success px-6 text-lg font-bold text-white shadow-md transition hover:bg-success/90"
          >
            ▶ {hasStarted ? "再開する" : "作業をはじめる"}
          </button>
        )}
      </div>
    </div>
  );
}
