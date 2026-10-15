"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 結果待ちのあいだ、読み直す間隔。自動の差し戻しは数分で届くので最初だけ短く、そのあとは職員の確認待ちなので長く */
const RESULT_POLL_FAST_MS = 20 * 1000;
const RESULT_POLL_FAST_FOR_MS = 10 * 60 * 1000;
const RESULT_POLL_SLOW_MS = 2 * 60 * 1000;
/** 素材・見本のリンク（署名つきURL）は1時間で切れるので、その前に読み直す */
const LINK_REFRESH_MS = 45 * 60 * 1000;

/**
 * 案件の画面を開いたままでも、新しい状態を表示する。
 * - レビュー結果を待っている間は読み直す（最初の10分は20秒ごと、そのあとは2分ごと。届いたらタブに「新着」が出る）
 * - 見本動画などのリンクが切れる前に読み直す（長く開いていると見本が再生できなかった）
 * 画面が見えていないときは読み直さず、見えるようになった時点で必要なら読み直す。
 */
export function TaskPageRefresher({ awaitingResult }: { awaitingResult: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const mountedAt = Date.now();
    let lastRefresh = mountedAt;
    const resultPollMs = () =>
      Date.now() - mountedAt < RESULT_POLL_FAST_FOR_MS ? RESULT_POLL_FAST_MS : RESULT_POLL_SLOW_MS;
    const refresh = () => {
      lastRefresh = Date.now();
      router.refresh();
    };
    const due = () => {
      const age = Date.now() - lastRefresh;
      return age >= LINK_REFRESH_MS || (awaitingResult && age >= resultPollMs());
    };
    const tick = () => {
      if (document.visibilityState === "visible" && due()) refresh();
    };
    const timer = window.setInterval(tick, awaitingResult ? RESULT_POLL_FAST_MS : 60 * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [awaitingResult, router]);

  return null;
}
