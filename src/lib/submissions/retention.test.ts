import { describe, expect, it } from "vitest";
import {
  selectExpiredSubmissions,
  selectOrphanPaths,
  type RetentionFeedback,
  type RetentionSubmission,
} from "./retention";

const NOW = new Date("2026-10-13T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

function sub(overrides: Partial<RetentionSubmission>): RetentionSubmission {
  return {
    id: "s1",
    assignment_id: "a1",
    version: 1,
    file_path: "u/a1/1_video.mp4",
    submitted_at: daysAgo(40),
    feedback: [],
    ...overrides,
  };
}

function fb(status: string, reviewedDaysAgo: number | null, createdDaysAgo = 60): RetentionFeedback {
  return {
    status,
    reviewed_at: reviewedDaysAgo === null ? null : daysAgo(reviewedDaysAgo),
    created_at: daysAgo(createdDaysAgo),
  };
}

describe("selectExpiredSubmissions", () => {
  it("職員の確認から保存期間が過ぎた動画を消す対象にする", () => {
    const rows = [sub({ feedback: [fb("approved", 31)] })];
    expect(selectExpiredSubmissions(rows, NOW, 30).map((s) => s.id)).toEqual(["s1"]);
  });

  it("確認から保存期間が過ぎていなければ残す", () => {
    const rows = [sub({ feedback: [fb("approved", 29)] })];
    expect(selectExpiredSubmissions(rows, NOW, 30)).toEqual([]);
  });

  it("AIが自動で差し戻した動画（reviewed_at が空）は、差し戻しを作った日から数える", () => {
    const old = [sub({ feedback: [fb("approved", null, 31)] })];
    const recent = [sub({ feedback: [fb("approved", null, 5)] })];
    expect(selectExpiredSubmissions(old, NOW, 30).map((s) => s.id)).toEqual(["s1"]);
    expect(selectExpiredSubmissions(recent, NOW, 30)).toEqual([]);
  });

  it("まだ職員が確認していない動画は、古くても残す", () => {
    const rows = [
      sub({ feedback: [fb("pending_review", null)] }),
      sub({ id: "s2", feedback: [fb("rejected", 60)] }),
      sub({ id: "s3", feedback: [] }),
    ];
    expect(selectExpiredSubmissions(rows, NOW, 30)).toEqual([]);
  });

  it("すでに消した動画（file_path が空）は対象にしない", () => {
    const rows = [sub({ file_path: null, feedback: [fb("approved", 90)] })];
    expect(selectExpiredSubmissions(rows, NOW, 30)).toEqual([]);
  });

  it("出し直しで置きかわった古い版は、新しい版の提出から保存期間が過ぎたら消す", () => {
    const rows = [
      sub({ id: "v1", version: 1, submitted_at: daysAgo(50) }),
      sub({ id: "v2", version: 2, submitted_at: daysAgo(35) }),
    ];
    expect(selectExpiredSubmissions(rows, NOW, 30).map((s) => s.id)).toEqual(["v1"]);
  });

  it("新しい版の提出から日が浅ければ、古い版も残す", () => {
    const rows = [
      sub({ id: "v1", version: 1, submitted_at: daysAgo(50) }),
      sub({ id: "v2", version: 2, submitted_at: daysAgo(3) }),
    ];
    expect(selectExpiredSubmissions(rows, NOW, 30)).toEqual([]);
  });

  it("別の案件の新しい提出は、置きかわりとみなさない", () => {
    const rows = [
      sub({ id: "x", assignment_id: "a1", version: 1 }),
      sub({ id: "y", assignment_id: "a2", version: 2 }),
    ];
    expect(selectExpiredSubmissions(rows, NOW, 30)).toEqual([]);
  });
});

describe("selectOrphanPaths", () => {
  const referenced = new Set(["u/a1/used.mp4"]);

  it("どの提出にも結びつかず、猶予を過ぎたファイルだけを消す対象にする", () => {
    const objects = [
      { path: "u/a1/used.mp4", created_at: daysAgo(90) },
      { path: "u/a1/orphan_old.mp4", created_at: daysAgo(8) },
      { path: "u/a1/orphan_new.mp4", created_at: daysAgo(1) },
    ];
    expect(selectOrphanPaths(objects, referenced, NOW, 7)).toEqual(["u/a1/orphan_old.mp4"]);
  });

  it("作成日が分からないファイルは消さない", () => {
    expect(selectOrphanPaths([{ path: "u/x.mp4", created_at: null }], referenced, NOW, 7)).toEqual([]);
  });
});
