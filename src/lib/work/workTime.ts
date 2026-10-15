// 作業時間の扱い。作業タイマーは「画面で ▶ を押してから ⏸ を押すまで」を数えるだけなので、
// 休憩の押し忘れや、画面を開いたまま席を外した時間も入ってしまう。
// ありえない長さで「時間がかかりすぎ」と評価しないよう、ここで扱いをそろえる。

/** 目安の何倍を超えたら「数え間違い（押し忘れ）」とみなして評価に使わないか */
export const WORK_MINUTES_PLAUSIBLE_RATIO = 3;

/** 画面から離れていたのがこれ以上なら、戻ったときに「休憩していましたか？」と聞く（分） */
export const IDLE_ASK_MINUTES = 30;

/** 評価に使ってよい作業時間（分）。分からない・ありえない長さなら null */
export function plausibleWorkMinutes(
  workMinutes: number | null,
  estimatedMinutes: number | null,
): number | null {
  if (workMinutes == null || !Number.isFinite(workMinutes) || workMinutes <= 0) return null;
  if (estimatedMinutes != null && estimatedMinutes > 0 && workMinutes > estimatedMinutes * WORK_MINUTES_PLAUSIBLE_RATIO) {
    return null;
  }
  return workMinutes;
}

const secondsKey = (id: string) => `work-seconds:${id}`;
const minutesKey = (id: string) => `work-minutes:${id}`; // 2026-10 より前の保存（分単位）

/** 保存してある作業時間（秒）。以前の分単位の保存からも読む */
export function readWorkSeconds(assignmentId: string): number {
  try {
    const sec = Number(localStorage.getItem(secondsKey(assignmentId)));
    if (Number.isFinite(sec) && sec > 0) return Math.floor(sec);
    const min = Number(localStorage.getItem(minutesKey(assignmentId)));
    return Number.isFinite(min) && min > 0 ? Math.floor(min * 60) : 0;
  } catch {
    return 0;
  }
}

export function writeWorkSeconds(assignmentId: string, seconds: number): void {
  try {
    localStorage.setItem(secondsKey(assignmentId), String(Math.max(0, Math.floor(seconds))));
  } catch {
    // 保存できない環境でも、画面の表示は続ける
  }
}

/** 提出に付ける作業時間（分、四捨五入） */
export function workMinutesForSubmit(assignmentId: string): number {
  return Math.round(readWorkSeconds(assignmentId) / 60);
}
