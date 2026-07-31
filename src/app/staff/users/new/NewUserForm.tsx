"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createUserAccount, type CreateUserState } from "@/lib/actions/users";

const initialState: CreateUserState = { error: null };

/** 英数字のランダムパスワードを生成（紛らわしい文字は除外） */
function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export function NewUserForm({ canCreateAdmin }: { canCreateAdmin: boolean }) {
  const [state, formAction, isPending] = useActionState(createUserAccount, initialState);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lastEmail, setLastEmail] = useState("");

  const inputClass =
    "mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none";

  if (state.success) {
    return (
      <div className="space-y-4 rounded-2xl border border-success/30 bg-success-soft p-5">
        <p className="font-bold text-success">
          {state.createdName} さんのアカウントを作成しました ✅
        </p>
        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="font-bold text-ink">ログイン情報（本人にお渡しください）</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-soft">メール</dt>
            <dd className="font-mono text-ink break-all">{lastEmail}</dd>
            <dt className="text-ink-soft">パスワード</dt>
            <dd className="font-mono text-ink break-all">{password}</dd>
          </dl>
          <p className="mt-2 text-xs text-ink-soft">
            このパスワードは今だけ表示されます。控えてから画面を閉じてください。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/staff/users"
            className="min-h-11 rounded-xl bg-primary px-5 py-2.5 font-bold text-white hover:bg-primary-dark"
          >
            利用者一覧へ戻る
          </Link>
          <button
            type="button"
            onClick={() => {
              setPassword("");
              setLastEmail("");
              window.location.reload();
            }}
            className="min-h-11 rounded-xl border-2 border-primary px-5 py-2.5 font-bold text-primary hover:bg-primary-soft"
          >
            続けてもう1人追加する
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => setLastEmail(String(new FormData(e.currentTarget).get("email") ?? ""))}
      className="space-y-4 rounded-2xl border border-line bg-surface p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="display_name" className="block font-bold text-ink">
            表示名 <span className="text-danger">*</span>
          </label>
          <input id="display_name" name="display_name" type="text" required
            placeholder="例: 山田 花子" className={inputClass} />
        </div>
        <div>
          <label htmlFor="display_name_kana" className="block font-bold text-ink">
            ふりがな（任意）
          </label>
          <input id="display_name_kana" name="display_name_kana" type="text"
            placeholder="例: やまだ はなこ" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block font-bold text-ink">
          メールアドレス（ログインID） <span className="text-danger">*</span>
        </label>
        <input id="email" name="email" type="email" required autoComplete="off"
          placeholder="例: hanako@example.com" className={inputClass} />
        <p className="mt-1 text-xs text-ink-soft">
          ログインに使います。本人のメールがない場合は、施設で決めた一意のアドレスでも構いません。
        </p>
      </div>

      <div>
        <label htmlFor="password" className="block font-bold text-ink">
          初期パスワード <span className="text-danger">*</span>
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8文字以上"
            className="w-full rounded-xl border-2 border-line p-3 font-mono focus:border-primary focus:outline-none"
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)}
            className="shrink-0 rounded-xl border-2 border-line px-3 font-bold text-ink-soft hover:border-primary hover:text-primary">
            {showPassword ? "隠す" : "表示"}
          </button>
          <button type="button" onClick={() => { setPassword(generatePassword()); setShowPassword(true); }}
            className="shrink-0 rounded-xl border-2 border-primary px-3 font-bold text-primary hover:bg-primary-soft">
            自動生成
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="role" className="block font-bold text-ink">
          種別 <span className="text-danger">*</span>
        </label>
        <select id="role" name="role" defaultValue="trainee" className={inputClass}>
          <option value="trainee">利用者（就労者）</option>
          <option value="staff">職員（スタッフ）</option>
          {canCreateAdmin && <option value="admin">管理者</option>}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "作成中…" : "アカウントを作成する"}
      </button>
    </form>
  );
}
