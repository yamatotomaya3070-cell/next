"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import {
  IconActivity,
  IconBriefcase,
  IconChart,
  IconCheckSquare,
  IconChevronLeft,
  IconChevronRight,
  IconClipboard,
  IconEdit,
  IconGlobe,
  IconHelp,
  IconHome,
  IconMessage,
  IconPlayCircle,
  IconSettings,
  IconSparkles,
  IconStar,
  IconTrophy,
  IconUpload,
  IconUsers,
  IconVideo,
} from "./icons";

export type SidebarIconName =
  | "home"
  | "briefcase"
  | "play"
  | "upload"
  | "edit"
  | "trophy"
  | "message"
  | "help"
  | "users"
  | "clipboard"
  | "sparkles"
  | "globe"
  | "check"
  | "star"
  | "activity"
  | "chart"
  | "settings";

const ICONS: Record<SidebarIconName, (props: { className?: string }) => ReactNode> = {
  home: IconHome,
  briefcase: IconBriefcase,
  play: IconPlayCircle,
  upload: IconUpload,
  edit: IconEdit,
  trophy: IconTrophy,
  message: IconMessage,
  help: IconHelp,
  users: IconUsers,
  clipboard: IconClipboard,
  sparkles: IconSparkles,
  globe: IconGlobe,
  check: IconCheckSquare,
  star: IconStar,
  activity: IconActivity,
  chart: IconChart,
  settings: IconSettings,
};

export interface SidebarItem {
  href: string;
  label: string;
  icon: SidebarIconName;
  /** 未実装機能は「準備中」として非活性表示にする */
  disabled?: boolean;
}

interface AppSidebarProps {
  items: SidebarItem[];
  storageKey?: string;
}

function parseHref(href: string): { pathname: string; status: string | null } {
  const [pathname, query] = href.split("?");
  const status = query
    ? (new URLSearchParams(query).get("status") ?? null)
    : null;
  return { pathname, status };
}

const COLLAPSE_EVENT = "sidebar-collapse-change";

/**
 * localStorage の折りたたみフラグを外部ストアとして購読する。
 * SSR中は false（展開状態）を返し、ハイドレーション後に保存値へ同期される。
 */
function useCollapsedFlag(storageKey: string): [boolean, () => void] {
  const key = `${storageKey}-collapsed`;

  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("storage", onChange); // 他タブでの変更
    window.addEventListener(COLLAPSE_EVENT, onChange); // 同一タブでの変更
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(COLLAPSE_EVENT, onChange);
    };
  }, []);

  const collapsed = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) === "1",
    () => false,
  );

  const toggle = useCallback(() => {
    const current = window.localStorage.getItem(key) === "1";
    window.localStorage.setItem(key, current ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }, [key]);

  return [collapsed, toggle];
}

/**
 * 左固定サイドバー。折りたたみ可能・現在地をアクティブ表示。
 */
export function AppSidebar({ items, storageKey = "sidebar" }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, toggle] = useCollapsedFlag(storageKey);

  const currentStatus = searchParams.get("status");

  const isActive = (href: string): boolean => {
    const target = parseHref(href);
    if (target.pathname !== pathname) return false;
    return target.status === currentStatus;
  };

  return (
    <aside
      className={`sticky top-18 hidden h-[calc(100vh-4.5rem)] shrink-0 flex-col border-r border-line bg-surface transition-all duration-200 md:flex ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
    >
      <nav aria-label="メインメニュー" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            if (item.disabled) {
              return (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    title={`${item.label}（準備中）`}
                    className={`flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-ink-soft/60 ${
                      collapsed ? "justify-center px-0" : ""
                    }`}
                  >
                    <Icon />
                    {!collapsed && (
                      <span className="flex-1 truncate font-medium">
                        {item.label}
                        <span className="ml-1 text-xs">（準備中）</span>
                      </span>
                    )}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 font-medium transition ${
                    collapsed ? "justify-center px-0" : ""
                  } ${
                    active
                      ? "bg-primary-soft text-primary-dark"
                      : "text-ink-soft hover:bg-page hover:text-ink"
                  }`}
                >
                  <Icon className={active ? "text-primary" : ""} />
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                  {!collapsed && active && (
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-primary"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed && (
        <div className="m-3 rounded-2xl bg-primary-soft p-4 text-center">
          <IconVideo className="mx-auto size-8 text-primary" />
          <p className="mt-2 text-sm leading-relaxed text-ink">
            困ったときは
            <br />
            サポートへご相談ください
          </p>
        </div>
      )}

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "メニューを広げる" : "メニューをたたむ"}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-ink-soft hover:bg-page hover:text-ink ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          {!collapsed && <span className="text-sm font-medium">たたむ</span>}
        </button>
      </div>
    </aside>
  );
}

/** モバイル向けの簡易ナビ（横スクロールのチップ）。PC優先方針のため最小限。 */
export function MobileNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status");

  return (
    <nav
      aria-label="メインメニュー"
      className="sticky top-18 z-30 flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2 md:hidden"
    >
      {items
        .filter((item) => !item.disabled)
        .map((item) => {
          const target = parseHref(item.href);
          const active =
            target.pathname === pathname && target.status === currentStatus;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                active
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
