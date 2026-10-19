// 作業PC（ワーカー）で工程が止まったとき、職員が読める説明文を作る。
// 「止まりました」だけでは原因がわからないので、どのPCで・どの工程で・なぜ止まったか・
// 最後に出ていたエラー文を1つの文にまとめて scene_jobs.error に残す。

/** エラー文として残す最後の行数。ffmpeg や node のエラーは最後の数行に原因が出る */
export const ERROR_TAIL_LINES = 20;
/** scene_jobs.error に入れる最大文字数（画面で読める長さ） */
export const ERROR_MAX_CHARS = 4000;

export interface StepFailure {
  /** 工程の名前（例：完成見本の書き出し） */
  step: string;
  /** 作業PCの名前 */
  host: string;
  /** 終了コード。強制終了されたときは null */
  code: number | null;
  /** 強制終了の合図（SIGKILL など）。ふつうに終わったときは null */
  signal: string | null;
  /** プログラムを起動できなかったときのエラー（node が見つからない等） */
  spawnError?: string;
  /** 最後に出ていたエラー出力 */
  stderrTail: string[];
  freeMemMB: number;
  totalMemMB: number;
}

/** 出力のうち最後の n 行だけ残す（空行は数えない） */
export function tailLines(text: string, n = ERROR_TAIL_LINES): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")
    .slice(-n);
}

function reason(f: StepFailure): string {
  if (f.spawnError) {
    return `プログラムを起動できませんでした（${f.spawnError}）。node・ffmpeg がこのPCに入っているか確かめてください。`;
  }
  if (f.signal || f.code === null) {
    return (
      `処理が途中で強制終了されました（${f.signal ?? "合図なし"}）。` +
      "メモリ不足、PCのスリープ・シャットダウン、ほかのソフトによる終了のどれかです。"
    );
  }
  return `エラーで止まりました（終了コード ${f.code}）。`;
}

export function describeStepFailure(f: StepFailure): string {
  const lines = [
    `【${f.step}】で止まりました（作業PC: ${f.host}）`,
    reason(f),
    `止まったときの空きメモリ: ${f.freeMemMB}MB / 全体 ${f.totalMemMB}MB`,
  ];
  if (f.stderrTail.length) lines.push("最後に出ていたエラー:", ...f.stderrTail);
  const text = lines.join("\n");
  return text.length > ERROR_MAX_CHARS ? `${text.slice(0, ERROR_MAX_CHARS)}…（以下省略）` : text;
}

/** ワーカーが処理中に連絡（locked_at の更新）を入れる間隔 */
export const HEARTBEAT_MS = 60_000;
/** この回数ぶん連絡が来なければ、ワーカーが止まったとみなす */
export const HEARTBEAT_MISSES = 5;

/** 処理中のジョブで、ワーカーからの連絡が途絶えているか */
export function isWorkerSilent(lockedAt: string | null, now: number): boolean {
  if (!lockedAt) return false;
  return now - new Date(lockedAt).getTime() > HEARTBEAT_MS * HEARTBEAT_MISSES;
}
