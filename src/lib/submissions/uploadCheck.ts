// 提出動画のアップロード前チェックと、失敗時の案内文。
// Supabase Storage はプロジェクト全体の「1ファイルの上限」（無料プランは 50MB）を超えると
// 受け付けない。大きな動画は送信に何分もかかってから断られるため、送る前に大きさで止める。

const MB = 1024 * 1024;

/** 1ファイルの上限（MB）。Supabase の Storage 設定を変えたら NEXT_PUBLIC_SUBMISSION_MAX_MB も合わせる */
export const SUBMISSION_MAX_MB = (() => {
  const n = Number(process.env.NEXT_PUBLIC_SUBMISSION_MAX_MB);
  return Number.isFinite(n) && n > 0 ? n : 50;
})();

const EXPORT_HINT =
  "書き出しのプリセット［絆_YouTube_720p］をえらんで書き出し直してください。プリセットが無いときは、フォーマット［MP4］・コーデック［H.264］・解像度［1280 × 720］・フレームレート［24］、［Rate Control］を［固定ビットレート］・［Bit Rate］を［600］、オーディオの［トラックのデータレート］を［128］にします（教科書「書き出す」の章）。";

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** 送る前の大きさチェック。問題なければ null、だめなら利用者向けの案内文 */
export function checkSubmissionSize(bytes: number, maxMb: number = SUBMISSION_MAX_MB): string | null {
  if (bytes <= 0) return "えらんだファイルの中身がありません。書き出しが終わってから、もう一度えらんでください。";
  if (bytes <= maxMb * MB) return null;
  return `ファイルが大きすぎて送れません（${formatMb(bytes)}。送れるのは ${maxMb} MB まで）。${EXPORT_HINT}`;
}

interface StorageErrorLike {
  message?: string;
  statusCode?: string | number;
  status?: string | number;
}

/** アップロード失敗の理由を、利用者が次に何をすればよいか分かる文にする */
export function describeUploadError(err: unknown, maxMb: number = SUBMISSION_MAX_MB): string {
  const e = (err ?? {}) as StorageErrorLike;
  const status = String(e.statusCode ?? e.status ?? "");
  const message = String(e.message ?? err ?? "");

  if (status === "413" || /exceeded the maximum allowed size|payload too large|too large/i.test(message)) {
    return `ファイルが大きすぎて送れませんでした（送れるのは ${maxMb} MB まで）。${EXPORT_HINT}`;
  }
  if (status === "401" || status === "403" || /row-level security|unauthorized|jwt/i.test(message)) {
    return "ログインの期限が切れている可能性があります。いちどログインし直してから、もう一度提出してください。";
  }
  if (err instanceof TypeError || /failed to fetch|network|timeout/i.test(message)) {
    return "送っている途中で通信が切れました。インターネットにつながっているか確かめて、もう一度提出してください。";
  }
  return `アップロードに失敗しました。時間をおいてもう一度試してください。続くときは職員の方にこの文を見せてください（${message || "理由不明"}）`;
}

/** Storage のパスに使うファイル名。日本語・空白は _ にまとめ、英数字が残らなければ video にする */
export function storagePathName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const safeBase = base.replace(/[^\w\-]+/g, "_");
  return `${/[A-Za-z0-9]/.test(safeBase) ? safeBase : "video"}.${ext || "mp4"}`;
}
