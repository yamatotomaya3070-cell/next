import { describe, expect, it } from "vitest";
import { KEEP_GAP_SEC, MIN_COUNTS, cutRegions, planRawTakes, type PlacedSegment, type RawLineInput } from "./rawTakes";

const scenes: RawLineInput[][] = [
  [{ speaker: "narrator", durSec: 3 }, { speaker: "haru", durSec: 2.5 }],
  [{ speaker: "mina", durSec: 4 }, { speaker: "haru", durSec: 1.2 }, { speaker: "mina", durSec: 3.5 }],
  [{ speaker: "narrator", durSec: 5 }],
  [{ speaker: "mina", durSec: 2.2 }, { speaker: "haru", durSec: 2.8 }],
];

const all = (plans: ReturnType<typeof planRawTakes>) => plans.flatMap((p) => p.segments);

describe("planRawTakes", () => {
  it("同じ案件からは同じ計画ができる", () => {
    expect(planRawTakes(scenes, "job-1")).toEqual(planRawTakes(scenes, "job-1"));
    expect(planRawTakes(scenes, "job-1")).not.toEqual(planRawTakes(scenes, "job-2"));
  });

  it("どのセリフも1回ずつ、順番どおりに入っている", () => {
    planRawTakes(scenes, "x").forEach((plan, si) => {
      const lis = plan.segments.flatMap((s) => (s.kind === "line" ? [s.li] : []));
      expect(lis).toEqual(scenes[si].map((_, i) => i));
    });
  });

  it("言いよどみ・言い直し・長い沈黙が最低限の数は入る", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const segs = all(planRawTakes(scenes, seed));
      expect(segs.filter((s) => s.kind === "ng" && s.cut === "filler").length).toBeGreaterThanOrEqual(MIN_COUNTS.filler);
      expect(segs.filter((s) => s.kind === "flub").length).toBeGreaterThanOrEqual(MIN_COUNTS.retake);
      expect(segs.filter((s) => s.kind === "silence" && s.cut === "long_gap").length).toBeGreaterThanOrEqual(MIN_COUNTS.long_gap);
    }
  });

  it("言いまちがえは2秒以上のセリフにだけ入り、そのあと必ず正しいセリフが続く", () => {
    planRawTakes(scenes, "seed").forEach((plan, si) => {
      plan.segments.forEach((s, i) => {
        if (s.kind !== "flub") return;
        expect(scenes[si][s.li].durSec).toBeGreaterThanOrEqual(2);
        const next = plan.segments.slice(i + 1).find((x) => x.kind === "line");
        expect(next).toEqual({ kind: "line", li: s.li });
      });
    });
  });

  it("録り始めの声は最初の場面、録り終わりの声は最後の場面だけ", () => {
    const plans = planRawTakes(scenes, "seed");
    const cues = plans.map((p) => p.segments.filter((s) => s.kind === "ng" && (s.clip === "start" || s.clip === "ok")).map((s) => (s.kind === "ng" ? s.clip : "")));
    expect(cues).toEqual([["start"], [], [], ["ok"]]);
  });

  it("小さく録れている場面は、最初の場面以外に1つだけ", () => {
    const quiet = planRawTakes(scenes, "seed").map((p, i) => [i, p.gainDb] as const).filter(([, g]) => g < 0);
    expect(quiet).toHaveLength(1);
    expect(quiet[0][0]).toBeGreaterThan(0);
  });
});

describe("cutRegions", () => {
  const at = (segment: PlacedSegment["segment"], startSec: number, endSec: number): PlacedSegment => ({ segment, startSec, endSec });

  it("言いよどみとそのあとの沈黙は1つの消す所にまとまり、セリフは残す所になる", () => {
    const { cuts, kept } = cutRegions([
      at({ kind: "silence", sec: 1.5, cut: "lead" }, 0, 1.5),
      at({ kind: "ng", clip: "start", speaker: "mina", cut: "start_cue" }, 1.5, 2.5),
      at({ kind: "line", li: 0 }, 2.5, 5),
      at({ kind: "silence", sec: 0.4 }, 5, 5.4),
      at({ kind: "ng", clip: "filler_ee", speaker: "mina", cut: "filler" }, 5.4, 5.9),
      at({ kind: "silence", sec: 0.2, cut: "filler" }, 5.9, 6.1),
      at({ kind: "line", li: 1 }, 6.1, 8),
    ]);
    expect(cuts).toEqual([
      { kind: "start_cue", startSec: 0, endSec: 2.5 },
      { kind: "filler", startSec: 5.4, endSec: 6.1 },
    ]);
    expect(kept.map((k) => k.li)).toEqual([0, 1]);
  });

  it("長い沈黙は、残してよい間をのぞいた分だけを消す所にする", () => {
    const { cuts } = cutRegions([at({ kind: "silence", sec: 3, cut: "long_gap" }, 10, 13)]);
    expect(cuts).toEqual([{ kind: "long_gap", startSec: 10 + KEEP_GAP_SEC / 2, endSec: 13 - KEEP_GAP_SEC / 2 }]);
  });
});

describe("ngVoiceRegions", () => {
  it("わざと入れた声だけを返し、言いまちがえて止まった声は入れない", async () => {
    const { ngVoiceRegions } = await import("./rawTakes");
    const regions = ngVoiceRegions([
      { segment: { kind: "flub", li: 0, ratio: 0.5 }, startSec: 0, endSec: 1 },
      { segment: { kind: "ng", clip: "cue_sorry", speaker: "haru", cut: "retake" }, startSec: 1.3, endSec: 2.5 },
      { segment: { kind: "line", li: 0 }, startSec: 3, endSec: 5 },
    ]);
    expect(regions).toEqual([{ kind: "retake", clip: "cue_sorry", speaker: "haru", startSec: 1.3, endSec: 2.5 }]);
  });
});
