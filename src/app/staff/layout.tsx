import { Suspense } from "react";
import { requireRole } from "@/lib/supabase/server";
import { AppHeader } from "@/components/ui/AppHeader";
import {
  AppSidebar,
  MobileNav,
  type SidebarItem,
} from "@/components/ui/AppSidebar";

export const dynamic = "force-dynamic";

// メニューは「案件」中心に集約し、実案件の学習は裏方の1項目にまとめる。
// （旧: 模擬案件／AI動画案件／CrowdWorks案件／参考動画の学習 の4分裂＋準備中4項目 → 統合）
const STAFF_NAV: SidebarItem[] = [
  { href: "/staff", label: "ダッシュボード", icon: "home" },
  { href: "/staff/users", label: "利用者", icon: "users" },
  { href: "/staff/tasks", label: "案件", icon: "clipboard" },
  { href: "/staff/cases/new", label: "CrowdWorks案件を配布", icon: "globe" },
  { href: "/staff/scene", label: "YouTube動画生成", icon: "sparkles" },
  { href: "/staff/reviews", label: "提出レビュー", icon: "check" },
  { href: "/staff/guidelines", label: "手順の学習ルール", icon: "sparkles" },
  { href: "/staff/guide", label: "動画編集の教科書", icon: "book" },
  { href: "/staff/messages", label: "メッセージ", icon: "message" },
];

const TITLE_MAP: Record<string, string> = {
  "/staff": "スタッフダッシュボード",
  "/staff/users": "利用者",
  "/staff/users/new": "利用者・職員の追加",
  "/staff/tasks": "案件",
  "/staff/tasks/new": "案件の生成",
  "/staff/cases/new": "CrowdWorks案件を配布",
  "/staff/scene": "YouTube動画生成",
  "/staff/video-ingests": "参考動画の学習",
  "/staff/reviews": "提出レビュー",
  "/staff/guidelines": "手順の学習ルール",
  "/staff/guide": "動画編集の教科書",
  "/staff/messages": "メッセージ",
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
