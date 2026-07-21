"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitWork, type ActionState } from "@/lib/actions/assignments";
import type { SelfCheckItem } from "@/lib/types";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmDialog";

interface SubmitFormProps {
  assignmentId: string;
  userId: string;
  selfCheckItems: string[];
}

const initialState: ActionState = { error: null };

/** 提出フォーム: ファイルアップロード + セルフチェック + コメント */
export function SubmitForm({
  assignmentId,
  userId,
  selfCheckItems,
}: SubmitFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitWork,
    initialState,
  );
  const [file, setFile] = useState<File | null>(null);
  const [checks, setChecks] = useState<boolean[]>(
    selfCheckItems.map(() => false),
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const selfCheck: SelfCheckItem[] = selfCheckItems.map((item, i) => ({
    item,
    checked: checks[i],
  }));

  async function handleSubmit(formData: FormData) {
    setUploadError(null);
    if (!file) {
      setUploadError("提出するファイルを選んでください。");
      return;
    }
    setIsUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${assignmentId}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("submissions")
        .upload(path, file, { upsert: false });
      if (error) {
        setUploadError(
          "アップロードに失敗しました。時間をおいてもう一度試してください。",
        );
        return;
      }
      formData.set("file_path", path);
      formData.set("file_name", file.name);
      formData.set(
        "work_minutes",
        localStorage.getItem(`work-minutes:${assignmentId}`) ?? "0",
      );
      formAction(formData);
    } finally {
      setIsUploading(false);
    }
  }

  const busy = isPending || isUploading;

  if (state.success) {
    return (
      <div className="rounded-2xl bg-success-soft p-6 text-center">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 text-xl font-bold text-ink">
          提出できました!
        </p>
        <p className="mt-1 text-success">
          結果が届くまで、少し待っていてください。
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input
        type="hidden"
        name="self_check"
        value={JSON.stringify(selfCheck)}
      />

      {/* 1. セルフチェック */}
      {selfCheckItems.length > 0 && (
        <fieldset className="rounded-2xl border-2 border-line bg-surface p-5">
          <legend className="px-2 text-lg font-bold text-ink">
            ✅ 提出前のチェック
          </legend>
          <div className="space-y-3">
            {selfCheckItems.map((item, i) => (
              <label
                key={i}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl p-2 text-lg hover:bg-page"
              >
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={(e) =>
                    setChecks((prev) =>
                      prev.map((c, j) => (j === i ? e.target.checked : c)),
                    )
                  }
                  className="h-6 w-6 rounded accent-success"
                />
                <span className="text-ink">{item}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* 2. ファイル選択 */}
      <div className="rounded-2xl border-2 border-line bg-surface p-5">
        <label className="mb-2 block text-lg font-bold text-ink">
          📁 できあがったファイル
        </label>
        <input
          type="file"
          accept="video/*,.mp4,.mov,.avi"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border-2 border-dashed border-line p-4 text-ink file:mr-4 file:min-h-11 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:font-bold file:text-white"
        />
        {file && (
          <p className="mt-2 text-sm text-success">
            選択中: {file.name}（{(file.size / 1024 / 1024).toFixed(1)} MB）
          </p>
        )}
      </div>

      {/* 3. コメント */}
      <div className="rounded-2xl border-2 border-line bg-surface p-5">
        <label
          htmlFor="note"
          className="mb-2 block text-lg font-bold text-ink"
        >
          💬 ひとことコメント（がんばった点・困った点）
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          placeholder="例: カットの位置を何度も見直しました"
          className="w-full rounded-xl border-2 border-line p-3 text-lg focus:border-primary focus:outline-none"
        />
      </div>

      {(uploadError || state.error) && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
          {uploadError ?? state.error}
        </p>
      )}

      <ConfirmSubmitButton
        title="この内容で提出しますか？"
        description="提出するとスタッフとAIのレビューが始まります。提出後も、もう一度提出して新しいバージョンに差し替えることができます。"
        confirmLabel="提出する"
        disabled={busy}
        className="min-h-14 w-full rounded-[10px] bg-success text-lg font-bold text-white shadow-card transition hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "提出しています…" : "提出する"}
      </ConfirmSubmitButton>
    </form>
  );
}
