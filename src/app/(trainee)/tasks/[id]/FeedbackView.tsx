import type { Feedback } from "@/lib/types";
import { Furigana } from "@/components/Furigana";

interface FeedbackViewProps {
  feedbacks: Feedback[];
  hasSubmission: boolean;
}

/** 承認済みフィードバックの表示（利用者向け） */
export function FeedbackView({
  feedbacks,
  hasSubmission,
}: FeedbackViewProps) {
  if (feedbacks.length === 0) {
    return (
      <section className="rounded-3xl border-2 border-line bg-surface p-6 text-center">
        {hasSubmission ? (
          <>
            <p className="text-3xl" aria-hidden>
              ⏳
            </p>
            <p className="mt-2 text-lg font-bold text-ink">
              いま採点しています
            </p>
            <p className="mt-1 text-ink-soft">
              結果が届くまで、少し待っていてください。
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl" aria-hidden>
              📤
            </p>
            <p className="mt-2 text-lg font-bold text-ink">
              まだ提出していません
            </p>
            <p className="mt-1 text-ink-soft">
              「提出」から作品を送ると、ここに結果が届きます。
            </p>
          </>
        )}
      </section>
    );
  }

  const latest = feedbacks[0];

  return (
    <section className="rounded-3xl border-2 border-success/30 bg-surface p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full bg-success-soft">
          <span className="text-2xl font-bold text-success">
            {latest.score ?? "--"}
          </span>
          <span className="text-xs text-success">てん</span>
        </div>
        <p className="text-lg font-bold leading-relaxed text-ink">
          {latest.summary && <Furigana text={latest.summary} />}
        </p>
      </div>

      {latest.good_points && latest.good_points.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold text-success">🌟 良かったところ</h3>
          <ul className="mt-2 space-y-2">
            {latest.good_points.map((point, i) => (
              <li
                key={i}
                className="rounded-xl bg-success-soft p-3 text-ink"
              >
                <Furigana text={point} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {latest.improve_points && latest.improve_points.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold text-primary-dark">💪 次にがんばるところ</h3>
          <ul className="mt-2 space-y-2">
            {latest.improve_points.map((point, i) => (
              <li key={i} className="rounded-xl bg-primary-soft p-3 text-primary-dark">
                <Furigana text={point} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {latest.criteria && latest.criteria.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold text-ink">📊 くわしい評価</h3>
          <div className="mt-2 space-y-2">
            {latest.criteria.map((c) => (
              <div
                key={c.key}
                className="flex items-center justify-between rounded-xl border border-line p-3"
              >
                <div>
                  <p className="font-bold text-ink">{c.label}</p>
                  <p className="text-sm text-ink-soft">{c.comment}</p>
                </div>
                <span className="shrink-0 text-lg" aria-label={`5点満点中${c.score}点`}>
                  {"★".repeat(c.score)}
                  <span className="text-line">
                    {"★".repeat(Math.max(0, 5 - c.score))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
