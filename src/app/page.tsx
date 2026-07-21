import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/** 環境未設定ならセットアップ案内、設定済みならログインへ */
export default function RootPage() {
  if (hasSupabaseEnv()) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">🛠 初期セットアップが必要です</h1>
      <p className="mt-4 text-lg text-slate-600">
        Supabase の接続情報が設定されていません。以下の手順でセットアップしてください。
      </p>
      <ol className="mt-8 list-decimal space-y-4 pl-6 text-slate-800">
        <li>
          <a
            href="https://supabase.com/dashboard"
            className="font-bold text-sky-700 underline"
          >
            Supabase
          </a>
          で新しいプロジェクトを作成する
        </li>
        <li>
          SQL Editor で <code className="rounded bg-slate-100 px-1">supabase/migrations/</code>{" "}
          の SQL を番号順に実行する
        </li>
        <li>
          <code className="rounded bg-slate-100 px-1">.env.example</code> を{" "}
          <code className="rounded bg-slate-100 px-1">.env.local</code>{" "}
          にコピーし、プロジェクトの URL と anon キーを設定する
        </li>
        <li>
          Authentication → Users でテストユーザー（職員・利用者）を作成する（詳細は README 参照）
        </li>
        <li>開発サーバーを再起動する</li>
      </ol>
    </main>
  );
}
