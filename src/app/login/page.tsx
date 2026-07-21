import { IconVideo } from "@/components/ui/icons";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
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
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 shadow-card">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
