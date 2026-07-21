import { Suspense } from "react";
import { requireRole } from "@/lib/supabase/server";
import { AppHeader } from "@/components/ui/AppHeader";
import {
  AppSidebar,
  MobileNav,
  type SidebarItem,
} from "@/components/ui/AppSidebar";

export const dynamic = "force-dynamic";

const STAFF_NAV: SidebarItem[] = [
  { href: "/staff", label: "ダッシュボード", icon: "home" },
  { href: "/staff/users", label: "利用者一覧", icon: "users" },
  { href: "/staff/tasks", label: "案件管理", icon: "clipboard" },
  { href: "/staff/tasks/new", label: "模擬案件", icon: "sparkles" },
  { href: "/staff/cases/new", label: "CrowdWorks案件", icon: "globe" },
  { href: "/staff/reviews", label: "提出レビュー", icon: "check" },
  { href: "/staff/ai", label: "AI評価", icon: "star", disabled: true },
  { href: "/staff/progress", label: "進行管理", icon: "activity", disabled: true },
  { href: "/staff/reports", label: "レポート", icon: "chart", disabled: true },
  { href: "/staff/settings", label: "設定", icon: "settings", disabled: true },
];

const TITLE_MAP: Record<string, string> = {
  "/staff": "スタッフダッシュボード",
  "/staff/users": "利用者一覧",
  "/staff/tasks": "案件管理",
  "/staff/tasks/new": "模擬案件の生成",
  "/staff/cases/new": "CrowdWorks案件の登録",
  "/staff/reviews": "提出レビュー",
};

export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("staff", "admin");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-primary"
      >
        本文へスキップ
      </a>
      <AppHeader
        homeHref="/staff"
        titleMap={TITLE_MAP}
        userName={profile.display_name}
        roleLabel={profile.role === "admin" ? "管理者" : "スタッフ"}
      />
      <Suspense fallback={null}>
        <MobileNav items={STAFF_NAV} />
      </Suspense>
      <div className="flex flex-1 items-stretch">
        <Suspense fallback={<div className="hidden w-60 shrink-0 md:block" />}>
          <AppSidebar items={STAFF_NAV} storageKey="staff-sidebar" />
        </Suspense>
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
