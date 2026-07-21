import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { IconLogout, IconVideo } from "./icons";
import { HeaderTitle } from "./HeaderTitle";
import { UserAvatar } from "./UserAvatar";

interface AppHeaderProps {
  homeHref: string;
  /** pathname の前方一致 → 画面名。長いパスを先に並べる。 */
  titleMap: Record<string, string>;
  userName: string;
  roleLabel: string;
}

/**
 * 上部固定ヘッダー（高さ72px）。
 * 左: ロゴ + 現在の画面名 / 右: ユーザー情報 + ログアウト
 */
export function AppHeader({
  homeHref,
  titleMap,
  userName,
  roleLabel,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-18 border-b border-line bg-surface">
      <div className="flex h-full items-center gap-6 px-4 md:px-6">
        <Link
          href={homeHref}
          className="flex min-w-0 items-center gap-2.5 md:w-[216px]"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
            <IconVideo />
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-base font-bold leading-tight text-ink">
              つなぐワークス
            </span>
            <span className="block truncate text-xs leading-tight text-ink-soft">
              動画編集ワークサポート
            </span>
          </span>
        </Link>

        <HeaderTitle titleMap={titleMap} />

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 sm:flex">
            <UserAvatar name={userName} />
            <span className="leading-tight">
              <span className="block text-sm font-bold text-ink">
                {userName} さん
              </span>
              <span className="block text-xs text-ink-soft">{roleLabel}</span>
            </span>
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-page hover:text-ink"
            >
              <IconLogout className="size-4" />
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
