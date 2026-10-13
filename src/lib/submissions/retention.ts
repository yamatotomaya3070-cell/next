// 確認が済んだ提出動画を、保存期間を過ぎたら Storage から消す。
// Supabase 無料プランは Storage 全体で 1GB まで。提出動画は1本 25〜45MB あり、
// 消さないと数十本で埋まって提出も案件生成も止まるため、毎日の Cron で古いものを消す。
// 消すのは動画ファイルだけで、提出の記録（file_name・コメント・判定・検品結果）は残す。
// 消した提出は file_path を null にする（file_name が残っていれば「保存期間切れで削除済み」と分かる）。

import type { SupabaseClient } from "@supabase/supabase-js";

/** 確認（合格・差し戻し）から、動画を残しておく日数 */
export const SUBMISSION_RETENTION_DAYS = 30;

/**
 * どの提出にも結びつかないファイル（送信は済んだが提出の記録に失敗したもの等）を残す日数。
 * 送信直後は提出の記録より先にファイルができるため、すぐには消さない。
 */
const ORPHAN_GRACE_DAYS = 7;

/** 1回の実行で消す最大本数（Storage の一括削除と実行時間を抑える） */
const MAX_DELETE_PER_RUN = 100;

const BUCKET = "submissions";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionFeedback {
  status: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface RetentionSubmission {
  id: string;
  assignment_id: string;
  version: number;
  file_path: string | null;
  submitted_at: string;
  feedback: RetentionFeedback[];
}

export interface StoredObject {
  path: string;
  created_at: string | null;
}

export interface CleanupResult {
  expired: number;
  orphans: number;
}

function cutoffOf(now: Date, days: number): number {
  return now.getTime() - days * DAY_MS;
}

function isBefore(iso: string | null, cutoff: number): boolean {
  return iso !== null && new Date(iso).getTime() <= cutoff;
}

/**
 * 動画を消してよい提出を選ぶ。次のどちらかを満たし、まだ動画が残っているもの。
 * - 確認済み（feedback が approved。合格も差し戻しも approved）になってから保存期間が過ぎた。
 *   AIの自動差し戻しは reviewed_at が空なので、その feedback を作った日から数える
 * - 同じ割当でもっと新しい版が出し直され、その提出日から保存期間が過ぎた（置きかわった古い版）
 * 未確認の提出は、どれだけ古くても残す（職員がまだ見ていないため）。
 */
export function selectExpiredSubmissions(
  rows: readonly RetentionSubmission[],
  now: Date,
  retentionDays: number = SUBMISSION_RETENTION_DAYS,
): RetentionSubmission[] {
  const cutoff = cutoffOf(now, retentionDays);

  return rows.filter((row) => {
    if (!row.file_path) return false;
    const reviewedLongAgo = row.feedback.some(
      (f) => f.status === "approved" && isBefore(f.reviewed_at ?? f.created_at, cutoff),
    );
    const supersededLongAgo = rows.some(
      (other) =>
        other.assignment_id === row.assignment_id &&
        other.version > row.version &&
        isBefore(other.submitted_at, cutoff),
    );
    return reviewedLongAgo || supersededLongAgo;
  });
}

/** Storage にあるが、どの提出の file_path にもなっていないファイルのうち、猶予を過ぎたもの */
export function selectOrphanPaths(
  objects: readonly StoredObject[],
  referencedPaths: ReadonlySet<string>,
  now: Date,
  graceDays: number = ORPHAN_GRACE_DAYS,
): string[] {
  const cutoff = cutoffOf(now, graceDays);
  return objects
    .filter((o) => !referencedPaths.has(o.path) && isBefore(o.created_at, cutoff))
    .map((o) => o.path);
}

/** バケット内のファイルを、フォルダ（{userId}/{assignmentId}/）をたどってすべて集める */
async function listAllObjects(supabase: SupabaseClient, prefix = ""): Promise<StoredObject[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`提出動画の一覧を読めませんでした: ${error.message}`);

  const nested = await Promise.all(
    (data ?? []).map(async (entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // list() はフォルダを id: null で返す
      if (entry.id === null) return listAllObjects(supabase, path);
      return [{ path, created_at: entry.created_at ?? null }];
    }),
  );
  return nested.flat();
}

async function removeFiles(supabase: SupabaseClient, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove([...paths]);
  if (error) throw new Error(`提出動画を消せませんでした: ${error.message}`);
}

/** 保存期間を過ぎた提出動画と、結びつく提出のないファイルを消す。service role のクライアントで呼ぶ */
export async function cleanupExpiredSubmissions(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<CleanupResult> {
  const { data, error } = await supabase
    .from("submissions")
    .select("id, assignment_id, version, file_path, submitted_at, feedback(status, reviewed_at, created_at)");
  if (error) throw new Error(`提出の一覧を読めませんでした: ${error.message}`);
  const rows = (data ?? []) as RetentionSubmission[];

  const expired = selectExpiredSubmissions(rows, now).slice(0, MAX_DELETE_PER_RUN);
  // 先に Storage から消す。DB 更新が失敗しても、次回は「無いファイルの削除」になるだけで安全にやり直せる
  await removeFiles(
    supabase,
    expired.map((s) => s.file_path as string),
  );
  if (expired.length > 0) {
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ file_path: null })
      .in(
        "id",
        expired.map((s) => s.id),
      );
    if (updateError) throw new Error(`提出の記録を更新できませんでした: ${updateError.message}`);
  }

  const referenced = new Set(
    rows.map((r) => r.file_path).filter((p): p is string => p !== null),
  );
  const orphans = selectOrphanPaths(await listAllObjects(supabase), referenced, now).slice(
    0,
    MAX_DELETE_PER_RUN,
  );
  await removeFiles(supabase, orphans);

  return { expired: expired.length, orphans: orphans.length };
}
