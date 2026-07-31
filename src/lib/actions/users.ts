"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

/**
 * 利用者・職員アカウントの作成（職員がアプリ上でユーザーを追加できるようにする）。
 *
 * auth.users への挿入トリガー(handle_new_user)が user_metadata の role/display_name から
 * profiles を自動生成する。ここでは service role の admin client で createUser を呼ぶ。
 * email_confirm:true で確認メール不要（職員が発行する内部アカウント想定）。
 *
 * 権限: staff/admin のみ。admin ロールの作成は admin のみ可（staff の自己昇格を防ぐ）。
 */

export interface CreateUserState {
  error: string | null;
  success?: boolean;
  createdName?: string;
}

const ALLOWED_ROLES: UserRole[] = ["trainee", "staff", "admin"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export async function createUserAccount(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const caller = await requireRole("staff", "admin");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const displayNameKana = String(formData.get("display_name_kana") ?? "").trim();
  const role = String(formData.get("role") ?? "trainee") as UserRole;

  // --- 入力検証（境界で必ず）---
  if (!displayName) return { error: "表示名を入力してください。" };
  if (!EMAIL_RE.test(email)) return { error: "メールアドレスの形式が正しくありません。" };
  if (password.length < MIN_PASSWORD) {
    return { error: `パスワードは${MIN_PASSWORD}文字以上にしてください。` };
  }
  if (!ALLOWED_ROLES.includes(role)) return { error: "権限の指定が不正です。" };
  // 権限昇格ガード: admin を作れるのは admin だけ
  if (role === "admin" && caller.role !== "admin") {
    return { error: "管理者アカウントを作成する権限がありません。" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, display_name: displayName },
  });

  if (error || !data?.user) {
    const msg = error?.message ?? "";
    if (/already been registered|already registered|duplicate/i.test(msg)) {
      return { error: "このメールアドレスは既に登録されています。" };
    }
    return { error: `アカウント作成に失敗しました: ${msg || "不明なエラー"}` };
  }

  // ふりがな（任意）は profiles にトリガーで作られた行へ追記する
  if (displayNameKana) {
    await admin
      .from("profiles")
      .update({ display_name_kana: displayNameKana })
      .eq("id", data.user.id);
  }

  revalidatePath("/staff/users");
  return { error: null, success: true, createdName: displayName };
}
