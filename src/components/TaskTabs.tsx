"use client";

import { useState, type ReactNode } from "react";

export interface TaskTab {
  id: string;
  label: string;
  icon: string;
  content: ReactNode;
  badge?: string;
}

interface TaskTabsProps {
  tabs: TaskTab[];
  initialTab?: string;
}

/**
 * 案件詳細のタブ切り替え。「1画面1操作」の原則で、
 * 一度に1つのパネルだけを表示する。
 */
export function TaskTabs({ tabs, initialTab }: TaskTabsProps) {
  const [active, setActive] = useState(initialTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
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
            onClick={() => setActive(tab.id)}
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
