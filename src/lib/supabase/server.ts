import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "./env";
import type { Profile, UserRole } from "@/lib/types";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component からの呼び出しでは set 不可（proxy.ts がセッションを更新する）
        }
      },
    },
  });
}

/** ログイン中ユーザーのプロフィールを取得。未ログインなら /login へ */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !profile) redirect("/login");
  return profile as Profile;
}

/** 指定ロールを要求。権限がなければ各ホームへ戻す */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect(profile.role === "trainee" ? "/home" : "/staff");
  }
  return profile;
}
