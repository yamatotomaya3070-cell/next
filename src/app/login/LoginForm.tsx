"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/lib/actions/auth";

const initialState: AuthState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-lg font-bold text-ink"
        >
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="example@mail.com"
          className="w-full rounded-xl border-2 border-line p-4 text-lg focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-lg font-bold text-ink"
        >
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border-2 border-line p-4 text-lg focus:border-primary focus:outline-none"
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="min-h-16 w-full rounded-2xl bg-primary text-xl font-bold text-white shadow-lg transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "ログインしています…" : "ログインする"}
      </button>
      <p className="text-center text-ink-soft">
        パスワードがわからない時は、職員に聞いてください。
      </p>
    </form>
  );
}
