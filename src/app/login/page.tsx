import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { logout } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import { IconLogout, IconVideo } from "@/components/ui/icons";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/buttons";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

/** ログイン中ならそのプロフィールを返す（未ログイン・エラー時は null） */
async function getCurrentProfile(): Promise<Profile | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
}

export default async function LoginPage() {
  const current = await getCurrentProfile();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-white">
            <IconVideo className="size-8" />
          </span>
          <h1 className="mt-4 text-3xl font-bold text-ink">つなぐワークス</h1>
          <p className="mt-1 text-lg text-ink-soft">動画編集ワークサポート</p>
          <p className="mt-3 text-[15px] text-ink-soft">
            自分のペースで、安心してお仕事を進められます
          </p>
        </div>

        {/* 共有PC対策: ログイン中のアカウントを明示し、続行か切り替えを選べるようにする */}
        {current && (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-primary-soft p-6">
            <p className="flex items-center gap-3">
              <UserAvatar name={current.display_name} />
              <span className="leading-tight">
                <span className="block font-bold text-ink">
                  いま {current.display_name} さんでログイン中です
                </span>
                <span className="block text-sm text-ink-soft">
                  {current.role === "trainee" ? "就労者" : "スタッフ"}
                  アカウント
                </span>
              </span>
            </p>
            <div className="mt-4 grid gap-2.5">
              <Link
                href={current.role === "trainee" ? "/home" : "/staff"}
                className={`${primaryButtonClass} w-full`}
              >
                {current.display_name} さんのまま続ける
              </Link>
              <form action={logout}>
                <button type="submit" className={`${secondaryButtonClass} w-full`}>
                  <IconLogout className="size-4" />
                  ログアウトする（別の人が使うとき）
                </button>
              </form>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              同じパソコンを交代で使うときは、必ずログアウトしてから次の人がログインしてください。
            </p>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 shadow-card">
          {current && (
            <p className="mb-4 rounded-xl bg-page p-3 text-sm text-ink-soft">
              下のフォームから別のアカウントでログインすると、
              {current.display_name} さんは自動的にログアウトされます。
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
