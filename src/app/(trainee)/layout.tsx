import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";
import { BreakReminder } from "@/components/BreakReminder";
import { AppHeader } from "@/components/ui/AppHeader";
import {
  AppSidebar,
  MobileNav,
  type SidebarItem,
} from "@/components/ui/AppSidebar";

export const dynamic = "force-dynamic";

const TRAINEE_NAV: SidebarItem[] = [
  { href: "/home", label: "ホーム", icon: "home" },
  // 案件の状態（未着手/作業中/レビュー待ち/修正依頼/完了）は
  // 受注案件ページ内の絞り込みで切り替える（メニューには分けて出さない）
  { href: "/works", label: "受注案件", icon: "briefcase" },
  { href: "/guide", label: "動画編集の教科書", icon: "book" },
  { href: "/messages", label: "メッセージ", icon: "message" },
  { href: "/support", label: "サポート", icon: "help" },
];

const TITLE_MAP: Record<string, string> = {
  "/home": "ホーム",
  "/works": "受注案件",
  "/tasks": "案件の詳細",
  "/guide": "動画編集の教科書",
  "/messages": "メッセージ",
  "/support": "サポート",
  "/settings": "設定",
};

export default async function TraineeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireProfile();
  if (profile.role !== "trainee") redirect("/staff");

  return (
    <div
      className={`flex min-h-full flex-1 flex-col ${
        profile.large_text_enabled ? "text-[1.125em]" : ""
      }`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-primary"
      >
        本文へスキップ
      </a>
      <AppHeader
        homeHref="/home"
        titleMap={TITLE_MAP}
        userName={profile.display_name}
        roleLabel="就労者"
      />
      <Suspense fallback={null}>
        <MobileNav items={TRAINEE_NAV} />
      </Suspense>
      <div className="flex flex-1 items-stretch">
        <Suspense fallback={<div className="hidden w-60 shrink-0 md:block" />}>
          <AppSidebar items={TRAINEE_NAV} storageKey="trainee-sidebar" />
        </Suspense>
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <BreakReminder intervalMinutes={profile.break_interval_minutes} />
    </div>
  );
}
