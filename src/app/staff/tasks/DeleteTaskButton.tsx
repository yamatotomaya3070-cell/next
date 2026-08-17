"use client";

import { deleteTask } from "@/lib/actions/tasks";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmDialog";

const dangerButtonClass =
  "inline-flex min-h-11 items-center rounded-xl border border-danger/30 bg-danger-soft px-3 text-sm font-bold text-danger transition hover:bg-danger hover:text-white";

export function DeleteTaskButton({ taskId, title }: { taskId: string; title: string }) {
  return (
    <form action={deleteTask}>
      <input type="hidden" name="task_id" value={taskId} />
      <ConfirmSubmitButton
        title="この案件を削除しますか？"
        description={`「${title}」と、その素材・割当・提出・レビューがすべて削除されます。元に戻せません。`}
        confirmLabel="削除する"
        className={dangerButtonClass}
      >
        削除
      </ConfirmSubmitButton>
    </form>
  );
}
