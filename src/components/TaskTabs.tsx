"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

export interface TaskTab {
  id: string;
  label: string;
  icon: string;
  content: ReactNode;
  badge?: string;
}

/** 新しく届いたもの（レビュー結果など）を、そのタブを開くまで知らせる */
export interface TabNotice {
  tabId: string;
  /** 届いている件数。前に見たときより増えていたら「新着」 */
  count: number;
  /** 見た件数を覚えておく localStorage のキー（案件ごと） */
  storageKey: string;
  message: string;
}

interface TaskTabsProps {
  tabs: TaskTab[];
  initialTab?: string;
  notice?: TabNotice;
}

const SEEN_EVENT = "kizuna:seen-change";

function readSeen(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(key: string, count: number) {
  try {
    localStorage.setItem(key, String(count));
  } catch {
    // 保存できなくても、知らせが残るだけで困らない
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener(SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * 案件詳細のタブ切り替え。「1画面1操作」の原則で、
 * 一度に1つのパネルだけを表示する。
 */
export function TaskTabs({ tabs, initialTab, notice }: TaskTabsProps) {
  const [active, setActive] = useState(initialTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];
  // サーバーで描くときは知らせなし（localStorage はブラウザでだけ読む）
  const seen = useSyncExternalStore(
    subscribeSeen,
    () => (notice ? readSeen(notice.storageKey) : null),
    () => null,
  );
  // そのタブを開いている間は知らせない。タブを出入りした時点で「見た」にする
  const hasNew =
    notice !== undefined && seen !== null && notice.count > seen && active !== notice.tabId;

  function selectTab(id: string) {
    if (notice && (id === notice.tabId || active === notice.tabId)) {
      writeSeen(notice.storageKey, notice.count);
    }
    setActive(id);
  }

  return (
    <div>
      {hasNew && notice && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-success bg-success-soft p-4"
        >
          <p className="text-lg font-bold text-ink">🔔 {notice.message}</p>
          <button
            type="button"
            onClick={() => selectTab(notice.tabId)}
            className="min-h-11 rounded-xl bg-success px-4 font-bold text-white transition hover:bg-success/90"
          >
            見る
          </button>
        </div>
      )}
      <div
        role="tablist"
        aria-label="案件の内容"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => selectTab(tab.id)}
            className={`relative min-h-16 rounded-xl border p-2 text-center transition ${
              active === tab.id
                ? "border-primary bg-primary text-white shadow-card"
                : "border-line bg-surface text-ink-soft hover:border-primary/40 hover:bg-primary-soft/50"
            }`}
          >
            <span className="block text-xl" aria-hidden>
              {tab.icon}
            </span>
            <span className="text-sm font-bold">
              {i + 1}. {tab.label}
            </span>
            {hasNew && notice?.tabId === tab.id && (
              <span className="absolute -left-1 -top-1 rounded-full bg-success px-2 py-0.5 text-xs font-bold text-white">
                新着
              </span>
            )}
            {tab.badge && (
              <span className="absolute -right-1 -top-1 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">
        {activeTab?.content}
      </div>
    </div>
  );
}
