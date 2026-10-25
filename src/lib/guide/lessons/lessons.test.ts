import { existsSync } from "node:fs";
import { PRACTICE_KEYS } from "../practiceCheck/keys.generated";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guideHref, guideLabel } from "../chapters";
import { LESSON_STAGES, LESSONS, PRACTICE_KITS, lessonsOfStage, neighborLessons } from "./index";

// 要件（docs/教科書の要件_2026-10-20.md）をテストで守る
describe("教科書のレッスン", () => {
  it("slug が重ならず、URL に使える文字だけ", () => {
    const slugs = LESSONS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("段0から段4まで、段の順・番号の順に一本道で並ぶ", () => {
    expect(LESSON_STAGES.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4]);
    for (const s of LESSON_STAGES) {
      const ls = lessonsOfStage(s.stage);
      expect(ls.length, `段${s.stage}`).toBeGreaterThan(0);
      ls.forEach((l, i) => expect(l.no, l.slug).toBe(`${s.stage}-${i + 1}`));
    }
    const stages = LESSONS.map((l) => l.stage);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
  });

  it("どのレッスンにも、できるようになること・手順・確かめること（3つまで）がある", () => {
    for (const l of LESSONS) {
      expect(l.goal, l.slug).not.toBe("");
      expect(l.parts.length, l.slug).toBeGreaterThan(0);
      expect(l.checks.length, l.slug).toBeGreaterThan(0);
      expect(l.checks.length, l.slug).toBeLessThanOrEqual(3);
      expect(l.minutes, l.slug).toBeGreaterThanOrEqual(10);
      expect(l.minutes, l.slug).toBeLessThanOrEqual(30);
    }
  });

  it("1つのまとまりの手順は9つまで（長くなったら分ける）", () => {
    for (const l of LESSONS) for (const p of l.parts) expect(p.steps.length, `${l.slug} ${p.title}`).toBeLessThanOrEqual(9);
  });

  it("Ctrl のキーには、Mac のときの書き方が付いている", () => {
    for (const l of LESSONS) {
      for (const p of l.parts) {
        for (const s of p.steps) if (s.key?.includes("Ctrl")) expect(s.mac, `${l.slug}: ${s.text}`).toBeTruthy();
      }
    }
  });

  it("自動配置・用意した型・プリセットに頼る説明がない", () => {
    const text = JSON.stringify(LESSONS);
    expect(text).not.toMatch(/絆_|絆の型|作業指示一覧|素材を並べる/);
  });

  it("画像はどれも public にある", () => {
    for (const l of LESSONS) {
      for (const p of l.parts) {
        for (const s of p.steps) {
          if (s.image) expect(existsSync(join(process.cwd(), "public", s.image.src)), `${l.slug}: ${s.image.src}`).toBe(true);
        }
      }
    }
  });

  it("段1・段2で素材を使うレッスンには、ダウンロードできる練習素材がある", () => {
    for (const l of LESSONS) {
      if (l.stage === 0 || l.stage > 2 || !l.material || l.slug === "dv-export") continue;
      expect(l.kit, l.slug).toBeDefined();
    }
    for (const k of Object.values(PRACTICE_KITS)) expect(existsSync(join(process.cwd(), "public", k.href)), k.href).toBe(true);
  });

  it("前後のレッスンは段をまたいでつながる", () => {
    expect(neighborLessons(LESSONS[0].slug).prev).toBeNull();
    expect(neighborLessons("pc-submit").next?.slug).toBe("dv-project");
    expect(neighborLessons(LESSONS[LESSONS.length - 1].slug).next).toBeNull();
  });
});

describe("教科書への参照", () => {
  it("レッスンの slug は、そのレッスンのページになる", () => {
    expect(guideHref("/guide", "cut-basics")).toBe("/guide/cut-basics");
    expect(guideLabel("cut-basics")).toBe("2-1 切る・消す・詰める");
  });

  it("以前の章の参照（前に作った案件の手順に残っている）は、今のレッスンへ読みかえる", () => {
    expect(guideHref("/guide", "subtitles#place")).toBe("/guide/sub-style");
    expect(guideHref("/guide", "arrange#auto")).toBe("/guide/place-video");
    expect(guideHref("/guide", "export#submit")).toBe("/guide/pc-submit");
    expect(guideHref("/guide", "cut#how")).toBe("/guide/cut-remove");
  });

  it("職員の章は章と節を指す", () => {
    expect(guideHref("/staff/guide", "worker#update")).toBe("/staff/guide/worker#update");
  });

  it("無い参照は null", () => {
    expect(guideHref("/guide", "nothing#here")).toBeNull();
  });

  it("その場で確かめるレッスンには、練習素材と答えの数字がある", () => {
    const checked = LESSONS.filter((l) => l.autoCheck);
    expect(checked.map((l) => l.no)).toEqual(["1-5", "2-1", "2-2", "2-3", "2-9", "2-11"]);
    for (const l of checked) {
      expect(l.kit ?? (l.no === "1-5" ? "dv-basics" : undefined), l.no).toBeTruthy();
      expect(PRACTICE_KEYS[l.autoCheck!], l.no).toBeTruthy();
    }
  });

  it("動画と写真のファイルが public にある", () => {
    const files: string[] = [];
    for (const l of LESSONS) {
      if (l.video) files.push(l.video.src, l.video.poster);
      for (const p of l.parts) {
        if (p.video) files.push(p.video.src, p.video.poster);
        for (const s of p.steps) if (s.image) files.push(s.image.src);
      }
      for (const pf of l.pitfalls ?? []) if (pf.video) files.push(pf.video.src, pf.video.poster);
    }
    for (const f of files) expect(existsSync(`public${f}`), f).toBe(true);
  });
});
