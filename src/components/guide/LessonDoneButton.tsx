"use client";

import { useState, useTransition } from "react";
import { setLessonDone } from "@/lib/actions/lessonProgress";
import { IconCheckCircle } from "@/components/ui/icons";

interface LessonDoneButtonProps {
  slug: string;
  initialDone: boolean;
}

/** レッスンの最後の「できた」。押すと記録され、目次で次のレッスンがわかるようになる */
export function LessonDoneButton({ slug, initialDone }: LessonDoneButtonProps) {
  const [isDone, setIsDone] = useState(initialDone);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !isDone;
    setError(null);
    startTransition(async () => {
      const result = await setLessonDone(slug, next);
      if (result.error) setError(result.error);
      else setIsDone(next);
    });
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={isDone}
        className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-base font-bold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success disabled:opacity-60 ${
          isDone ? "border-2 border-success bg-surface text-success hover:bg-success-soft/40" : "bg-success text-white hover:brightness-95"
        }`}
      >
        <IconCheckCircle className="size-5" />
        {isPending ? "記録しています…" : isDone ? "できた（記録ずみ）" : "全部できたので、記録する"}
      </button>
      {isDone && !isPending && <p className="mt-2 text-sm text-ink-soft">まちがえて押したときは、もう一度押すと取り消せます。</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
