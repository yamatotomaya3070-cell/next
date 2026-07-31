"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createIngestUploadUrl, registerVideoIngest } from "@/lib/actions/videoIngests";

type Phase = "idle" | "uploading" | "registering" | "done" | "error";

export function UploadIngestForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [genreHint, setGenreHint] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const busy = phase === "uploading" || phase === "registering";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setPhase("error");
      setMessage("動画ファイルを選んでください。");
      return;
    }
    if (!title.trim()) {
      setPhase("error");
      setMessage("タイトルを入力してください。");
      return;
    }

    // 1. 署名付きアップロードURLを発行
    setPhase("uploading");
    const signed = await createIngestUploadUrl(file.name);
    if (signed.error || !signed.path || !signed.token) {
      setPhase("error");
      setMessage(signed.error ?? "アップロードURLの発行に失敗しました。");
      return;
    }

    // 2. ブラウザから直接 Storage へアップロード（Vercelのボディ上限を回避）
    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from("materials")
      .uploadToSignedUrl(signed.path, signed.token, file);
    if (upErr) {
      setPhase("error");
      setMessage(`アップロードに失敗しました: ${upErr.message}`);
      return;
    }

    // 3. 取り込み行を登録（解析はワーカーが拾う）
    setPhase("registering");
    const res = await registerVideoIngest({
      title,
      genreHint,
      storagePath: signed.path,
      consent,
    });
    if (res.error) {
      setPhase("error");
      setMessage(res.error);
      return;
    }

    setPhase("done");
    setMessage("取り込みました。クラウドで自動解析され、下の一覧に反映されます（「今すぐ解析する」で即実行も可能）。");
    setTitle("");
    setGenreHint("");
    setConsent(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div>
        <label htmlFor="ingest_file" className="block font-bold text-ink">
          参考/実案件の動画 <span className="text-danger">*</span>
        </label>
        <p className="mt-1 text-sm text-ink-soft">
          クラウドワークスの参考動画・完成見本などを選んでください。ブラウザから直接アップロードするので大きい動画も扱えます。
        </p>
        <input
          id="ingest_file"
          ref={fileRef}
          type="file"
          accept="video/*"
          className="mt-2 w-full rounded-xl border-2 border-line p-3"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ingest_title" className="block font-bold text-ink">
            タイトル <span className="text-danger">*</span>
          </label>
          <input
            id="ingest_title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            type="text"
            placeholder="例: 在庫管理の解説動画（参考）"
            className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="ingest_genre" className="block font-bold text-ink">
            ジャンルのヒント（任意）
          </label>
          <input
            id="ingest_genre"
            value={genreHint}
            onChange={(e) => setGenreHint(e.target.value)}
            type="text"
            placeholder="例: ビジネス解説"
            className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-5 w-5"
        />
        <span>
          この動画を学習に使う許諾を確認済みです（実案件の場合は依頼者の許諾が前提です）。
          未チェックでも取り込めますが、許諾は「保留」になります。
        </span>
      </label>

      {message && (
        <p
          role={phase === "error" ? "alert" : undefined}
          className={`rounded-xl p-4 font-bold ${
            phase === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
          }`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {phase === "uploading"
          ? "アップロード中…"
          : phase === "registering"
            ? "登録中…"
            : "動画を取り込む"}
      </button>
    </form>
  );
}
