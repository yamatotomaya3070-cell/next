import { describe, expect, it } from "vitest";
import { normalizeStyleGuide, type StyleGuideContent } from "@/lib/style-guide/schema";
import {
  DEFAULT_TARGET_KEEP_SECONDS,
  HOOK_WINDOW_SECONDS,
  MIN_SEGMENTS,
  normalizePracticeScript,
  practiceScriptStats,
  validatePracticeScriptBalance,
  type GeneratedPracticeScript,
} from "./schema";

/** テスト用の2キャラのスタイルガイド */
function guide(): StyleGuideContent {
  return normalizeStyleGuide({
    name: "テスト",
    characters: [
      { key: "ao", name: "アオ", subtitleColor: "#1677E8", seed: 1000 },
      { key: "midori", name: "ミドリ", subtitleColor: "#2E9E5B", seed: 2000 },
    ],
  });
}

describe("normalizePracticeScript", () => {
  it("空/不正な入力でも最低限のセグメントを持つ台本を返す", () => {
    const s = normalizePracticeScript(null, guide());
    expect(s.segments.length).toBeGreaterThanOrEqual(MIN_SEGMENTS);
    expect(s.targetKeepSeconds).toBe(DEFAULT_TARGET_KEEP_SECONDS);
    expect(s.title).toContain("編集");
  });

  it("話者キーはスタイルガイドのキャラに無ければ先頭キャラに寄せる", () => {
    const s = normalizePracticeScript(
      {
        segments: [
          { text: "a", speakerKey: "unknown", priority: "must", estimatedSeconds: 5 },
          { text: "b", speakerKey: "midori", priority: "must", estimatedSeconds: 5 },
          { text: "c", speakerKey: "ao", priority: "optional", estimatedSeconds: 5 },
        ],
      },
      guide(),
    );
    expect(s.segments[0].speakerKey).toBe("ao"); // unknown → 先頭
    expect(s.segments[1].speakerKey).toBe("midori");
  });

  it("不明な priority は must に倒し、must の cutReason は落とす", () => {
    // フック域(先頭15秒)に飲まれないよう各10秒にし、seg2 をフック域外に置く
    const s = normalizePracticeScript(
      {
        segments: [
          { text: "x", priority: "weird", cutReason: "filler", estimatedSeconds: 10 },
          { text: "y", priority: "must", cutReason: "tangent", estimatedSeconds: 10 },
          { text: "z", priority: "optional", cutReason: "bogus", estimatedSeconds: 10 },
        ],
      },
      guide(),
    );
    expect(s.segments[0].priority).toBe("must");
    expect(s.segments[0].cutReason).toBeNull();
    expect(s.segments[1].cutReason).toBeNull(); // must なので落とす
    expect(s.segments[2].priority).toBe("optional");
    expect(s.segments[2].cutReason).toBe("weak"); // 不正な理由は weak にフォールバック
  });

  it("冒頭15秒以内は must フックに、フック域外は isHook=false に統一する", () => {
    const s = normalizePracticeScript(
      {
        segments: [
          { text: "hook1", priority: "optional", cutReason: "filler", estimatedSeconds: 8 },
          { text: "hook2", priority: "optional", estimatedSeconds: 5 }, // ここまで13秒
          { text: "body", priority: "optional", estimatedSeconds: 20, isHook: true }, // 域外なのに isHook 主張
        ],
      },
      guide(),
    );
    // 先頭2本はフック域(累積<15s)→must昇格＋isHook
    expect(s.segments[0].isHook).toBe(true);
    expect(s.segments[0].priority).toBe("must");
    expect(s.segments[1].isHook).toBe(true);
    // 3本目は域外→isHook 剥奪、optional のまま
    expect(s.segments[2].isHook).toBe(false);
    expect(s.segments[2].priority).toBe("optional");
  });

  it("estimatedSeconds が無ければ text 長から推定し、空文字は既定2秒", () => {
    const longText = "あ".repeat(70); // 70/7 = 10秒
    const s = normalizePracticeScript(
      {
        segments: [
          { text: longText, priority: "must" },
          { text: "", priority: "must" },
          { text: "普通", priority: "optional" },
        ],
      },
      guide(),
    );
    expect(s.segments[0].estimatedSeconds).toBe(10);
    expect(s.segments[1].estimatedSeconds).toBe(2);
  });

  it("id の重複は一意化する", () => {
    const s = normalizePracticeScript(
      {
        segments: [
          { id: "dup", text: "a", priority: "must", estimatedSeconds: 5 },
          { id: "dup", text: "b", priority: "must", estimatedSeconds: 5 },
          { id: "dup", text: "c", priority: "optional", estimatedSeconds: 5 },
        ],
      },
      guide(),
    );
    const ids = s.segments.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("order は1から連番で振り直す", () => {
    const s = normalizePracticeScript(
      {
        segments: [
          { text: "a", order: 99, priority: "must", estimatedSeconds: 5 },
          { text: "b", order: 3, priority: "must", estimatedSeconds: 5 },
          { text: "c", order: 1, priority: "optional", estimatedSeconds: 5 },
        ],
      },
      guide(),
    );
    expect(s.segments.map((x) => x.order)).toEqual([1, 2, 3]);
  });
});

describe("practiceScriptStats", () => {
  it("must/optional/フックの尺を集計する", () => {
    const s: GeneratedPracticeScript = normalizePracticeScript(
      {
        segments: [
          { text: "h", priority: "must", estimatedSeconds: 10, isHook: true },
          { text: "m", priority: "must", estimatedSeconds: 20 },
          { text: "o", priority: "optional", cutReason: "tangent", estimatedSeconds: 30 },
        ],
      },
      guide(),
    );
    const stats = practiceScriptStats(s);
    expect(stats.mustSeconds).toBe(30);
    expect(stats.optionalSeconds).toBe(30);
    expect(stats.totalSeconds).toBe(60);
    expect(stats.mustCount).toBe(2);
    expect(stats.optionalCount).toBe(1);
    expect(stats.hookSeconds).toBeGreaterThanOrEqual(10);
  });
});

describe("validatePracticeScriptBalance", () => {
  it("バランスが取れた台本は警告なし", () => {
    // target=100秒、must=100秒、total=140秒(1.4倍)、optional有り、フック有り
    const segments = [
      { text: "hook", priority: "must", estimatedSeconds: 12, isHook: true },
      { text: "m1", priority: "must", estimatedSeconds: 44 },
      { text: "m2", priority: "must", estimatedSeconds: 44 },
      { text: "o1", priority: "optional", cutReason: "tangent", estimatedSeconds: 20 },
      { text: "o2", priority: "optional", cutReason: "redundant", estimatedSeconds: 20 },
    ];
    const s = normalizePracticeScript({ segments }, guide(), 100);
    const warnings = validatePracticeScriptBalance(s);
    expect(warnings).toEqual([]);
  });

  it("optional が無い/総量が過少だと警告を出す", () => {
    const s = normalizePracticeScript(
      {
        segments: [
          { text: "a", priority: "must", estimatedSeconds: 30, isHook: true },
          { text: "b", priority: "must", estimatedSeconds: 30 },
          { text: "c", priority: "must", estimatedSeconds: 30 },
        ],
      },
      guide(),
      600,
    );
    const warnings = validatePracticeScriptBalance(s);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes("切る候補"))).toBe(true);
  });

  it("HOOK_WINDOW_SECONDS は妥当な範囲", () => {
    expect(HOOK_WINDOW_SECONDS).toBeGreaterThan(0);
  });
});
