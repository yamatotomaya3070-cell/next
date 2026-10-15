"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logProgress } from "@/lib/actions/assignments";
import { IDLE_ASK_MINUTES, readWorkSeconds, writeWorkSeconds } from "@/lib/work/workTime";

interface WorkTimerProps {
  assignmentId: string;
  estimatedMinutes: number | null;
  alreadyStarted: boolean;
}

/**
 * 作業時間タイマー。開始/休憩を記録し、経過秒数を localStorage に保持する。
 *
 * 作業は DaVinci の画面で行うので、この画面が隠れていても数え続ける。そのかわり、
 * この画面に長く戻ってこなかったときは「休憩していましたか？」と聞き、休憩なら
 * その分を引く（休憩の押し忘れや、開いたまま席を外した時間が作業時間に入らないように）。
 */
export function WorkTimer({
  assignmentId,
  estimatedMinutes,
  alreadyStarted,
}: WorkTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  // SSRとクライアント初回レンダーの不一致（ハイドレーションエラー）を避けるため、
  // 初期値は常に0にし、localStorageからの復元はマウント後のuseEffectで行う。
  const [seconds, setSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(alreadyStarted);
  /** 戻ってきたときに確かめる、画面から離れていた秒数 */
  const [awaySeconds, setAwaySeconds] = useState<number | null>(null);
  const isFirstSaveRef = useRef(true);
  /** タイマーが動いている間の基準（何時から、何秒の続きを数えているか）。setInterval の遅れに左右されない */
  const runRef = useRef<{ since: number; base: number } | null>(null);
  const lastSeenRef = useRef(0);

  // マウント後に保存済みの作業時間を復元（localStorageという外部ストアからの
  // マウント時1回限りの同期であり、反応的な再レンダーの連鎖ではないためlintを抑制する）
  useEffect(() => {
    const stored = readWorkSeconds(assignmentId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored > 0) setSeconds(stored);
  }, [assignmentId]);

  // 経過秒数を保存（復元前の初回レンダーでは保存しない＝0で上書きしない）
  useEffect(() => {
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    writeWorkSeconds(assignmentId, seconds);
  }, [seconds, assignmentId]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      const run = runRef.current;
      if (run) setSeconds(run.base + Math.floor((Date.now() - run.since) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  // この画面を見た・さわった時刻を覚えておき、長く離れていたら戻ったときに聞く
  useEffect(() => {
    if (!isRunning) return;
    lastSeenRef.current = Date.now();
    const onActive = (e?: Event) => {
      if (document.visibilityState !== "visible") return;
      // 休憩ボタンそのものを押したときは聞かない（押した時点で止まるので）
      if (e?.target instanceof Element && e.target.closest("[data-pause-button]")) {
        lastSeenRef.current = Date.now();
        return;
      }
      const away = Date.now() - lastSeenRef.current;
      lastSeenRef.current = Date.now();
      if (away >= IDLE_ASK_MINUTES * 60 * 1000) setAwaySeconds(Math.floor(away / 1000));
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") lastSeenRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", onActive);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pointerdown", onActive);
    window.addEventListener("keydown", onActive);
    return () => {
      document.removeEventListener("visibilitychange", onActive);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pointerdown", onActive);
      window.removeEventListener("keydown", onActive);
    };
  }, [isRunning]);

  const handleStart = useCallback(async () => {
    runRef.current = { since: Date.now(), base: seconds };
    setIsRunning(true);
    const event = hasStarted ? "resume" : "start";
    setHasStarted(true);
    await logProgress(assignmentId, event);
  }, [assignmentId, hasStarted, seconds]);

  const handlePause = useCallback(
    async (total: number = seconds) => {
      runRef.current = null;
      setIsRunning(false);
      setSeconds(total);
      await logProgress(assignmentId, "break", {
        minutesDelta: Math.floor(total / 60),
      });
    },
    [assignmentId, seconds],
  );

  // 離れていた間は休憩だった → その分を引いて休憩中にする
  const answerWasBreak = useCallback(async () => {
    const away = awaySeconds ?? 0;
    setAwaySeconds(null);
    await handlePause(Math.max(0, seconds - away));
  }, [awaySeconds, handlePause, seconds]);

  const mins = Math.floor(seconds / 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const ss = seconds % 60;
  const awayMinutes = awaySeconds === null ? 0 : Math.round(awaySeconds / 60);

  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-ink-soft">作業時間</p>
          <p
            className="font-mono text-3xl font-bold text-ink"
            aria-live="polite"
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
            data-pause-button
            onClick={() => handlePause()}
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
      {isRunning && (
        <p className="mt-2 text-sm text-ink-soft">
          休むときは「⏸ 休憩する」を押してください。押し忘れても、あとで直せます。
        </p>
      )}
      {awaySeconds !== null && (
        <div
          role="alertdialog"
          aria-label="休憩していましたか"
          className="mt-4 rounded-xl border-2 border-warning/40 bg-warning-soft p-4"
        >
          <p className="font-bold text-ink">
            この画面から約{awayMinutes}分はなれていました。そのあいだ、休憩していましたか？
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={answerWasBreak}
              className="min-h-11 rounded-xl bg-warning px-4 font-bold text-ink transition hover:bg-warning/90"
            >
              休憩していた（{awayMinutes}分を引く）
            </button>
            <button
              type="button"
              onClick={() => setAwaySeconds(null)}
              className="min-h-11 rounded-xl border-2 border-line bg-surface px-4 font-bold text-ink transition hover:bg-page"
            >
              作業していた（そのまま）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
