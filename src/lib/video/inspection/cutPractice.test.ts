import { describe, expect, it } from "vitest";
import {
  checkCutLines,
  checkCutOrder,
  checkGaps,
  checkRemnants,
  checkVoiceLevels,
  type CutLineObservation,
} from "./cutPractice";

const line = (scene: number, startSec: number | null, durationSec = 3, text = "セリフ"): CutLineObservation => ({ scene, text, durationSec, startSec });

describe("checkCutLines", () => {
  it("全部見つかれば合格", () => {
    expect(checkCutLines([line(1, 5), line(1, 9)]).status).toBe("pass");
  });
  it("長いセリフが見つからなければ不合格（切りすぎ）", () => {
    const item = checkCutLines([line(1, 5), line(2, null, 3, "毎月5万円まで積み立てられます")]);
    expect(item.status).toBe("fail");
    expect(item.message).toContain("場面2");
  });
  it("短いセリフだけが見つからないときは職員確認", () => {
    expect(checkCutLines([line(1, 5), line(2, null, 1.0)]).status).toBe("unknown");
  });
});

describe("checkCutOrder", () => {
  it("台本より前にさかのぼるセリフがあれば不合格", () => {
    expect(checkCutOrder([line(1, 5), line(1, 9), line(2, 7)]).status).toBe("fail");
    expect(checkCutOrder([line(1, 5), line(1, 9)]).status).toBe("pass");
  });
});

describe("checkRemnants", () => {
  it("消す声が残っていなければ合格", () => {
    expect(checkRemnants([{ kindJa: "言いよどみ", text: "えー", durationSec: 0.9, found: [] }]).status).toBe("pass");
  });
  it("十分長い消す声が残っていれば不合格で、時間を知らせる", () => {
    const item = checkRemnants([{ kindJa: "言い直し", text: "あ、すみません。もう一回いきます。", durationSec: 1.8, found: [{ atSec: 83, score: 0.9 }] }]);
    expect(item.status).toBe("fail");
    expect(item.message).toContain("1分23秒");
  });
  it("短い声だけが見つかったときは職員確認", () => {
    expect(checkRemnants([{ kindJa: "言いよどみ", text: "まあ", durationSec: 0.5, found: [{ atSec: 10, score: 0.9 }] }]).status).toBe("unknown");
  });
  it("一致が弱いときは、似た声の見まちがいもありうるので職員確認", () => {
    expect(checkRemnants([{ kindJa: "言いよどみ", text: "あのー", durationSec: 1.0, found: [{ atSec: 153, score: 0.31 }] }]).status).toBe("unknown");
  });
});

describe("checkGaps", () => {
  it("同じ場面で2秒をこえる間があれば不合格", () => {
    // 1本目は 5〜8秒、2本目は 10.5秒から → 間 2.5秒
    expect(checkGaps([line(1, 5), line(1, 10.5)]).status).toBe("fail");
  });
  it("場面の切りかえは長めの間を許す", () => {
    expect(checkGaps([line(1, 5), line(2, 10.5)]).status).toBe("unknown");
    expect(checkGaps([line(1, 5), line(2, 9)]).status).toBe("pass");
  });
  it("ふつうの間なら合格", () => {
    expect(checkGaps([line(1, 5), line(1, 8.3)]).status).toBe("pass");
  });
});

describe("checkVoiceLevels", () => {
  it("1場面だけ大きく小さいままなら不合格で、その場面を知らせる", () => {
    const item = checkVoiceLevels([{ scene: 1, db: -20 }, { scene: 2, db: -27 }, { scene: 3, db: -20.5 }]);
    expect(item.status).toBe("fail");
    expect(item.message).toContain("場面2");
  });
  it("そろっていれば合格", () => {
    expect(checkVoiceLevels([{ scene: 1, db: -20 }, { scene: 2, db: -21 }, { scene: 3, db: -20.5 }]).status).toBe("pass");
  });
  it("測れなければ職員確認", () => {
    expect(checkVoiceLevels([{ scene: 1, db: null }]).status).toBe("unknown");
  });
});
