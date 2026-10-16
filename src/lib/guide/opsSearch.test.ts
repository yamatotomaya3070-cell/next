import { describe, expect, it } from "vitest";
import {
  bigramSimilarity,
  normalizeForSearch,
  searchOperations,
  stripRequestPhrase,
  toSearchTerms,
  type SearchableOperation,
} from "./opsSearch";

const op = (id: string, title: string, aliases: string[], what = ""): SearchableOperation => ({
  id,
  title,
  aliases,
  what,
  where: { page: "エディット", panel: "タイムライン" },
  steps: [{ text: "クリップをクリックする" }],
});

const OPS = [
  op("fade-video", "映像をフェードイン・フェードアウトさせる", ["フェード", "だんだん出す", "ふわっと出す"]),
  op("volume-clip", "クリップの音量を変える", ["音量", "ボリューム", "音を小さく"]),
  op("blade", "クリップを切る（分割）", ["カット", "分割", "ブレード"], "1本のクリップを2つに分けます"),
  op("bgm", "BGM を入れる", ["BGM", "音楽", "ビージーエム"]),
];

describe("normalizeForSearch", () => {
  it("カタカナはひらがなに、全角英数は半角の小文字にそろえる", () => {
    expect(normalizeForSearch("フェード")).toBe("ふぇーど");
    expect(normalizeForSearch("ＢＧＭ")).toBe("bgm");
    expect(normalizeForSearch("Bgm")).toBe("bgm");
  });

  it("半角カナも全角と同じになる", () => {
    expect(normalizeForSearch("ﾌｪｰﾄﾞ")).toBe(normalizeForSearch("フェード"));
  });

  it("空白や記号は無視する", () => {
    expect(normalizeForSearch(" フェード・イン ")).toBe("ふぇーどいん");
    expect(normalizeForSearch("［インスペクタ］")).toBe("いんすぺくた");
  });
});

describe("stripRequestPhrase", () => {
  it("依頼書の言い回しを外す", () => {
    expect(stripRequestPhrase("フェードしてください")).toBe("フェード");
    expect(stripRequestPhrase("カットのやり方")).toBe("カット");
    expect(stripRequestPhrase("音量を")).toBe("音量");
  });

  it("カタカナの語の終わりを助詞と取りちがえない", () => {
    expect(toSearchTerms("カット")).toEqual(["かっと"]);
    expect(toSearchTerms("カットしてください")).toEqual(["かっと"]);
  });

  it("言い回しだけの語は消さない", () => {
    expect(stripRequestPhrase("する")).toBe("する");
  });
});

describe("toSearchTerms", () => {
  it("全角空白でも区切る", () => {
    expect(toSearchTerms("BGM　音量")).toEqual(["bgm", "音量"]);
  });

  it("空の入力は語なし", () => {
    expect(toSearchTerms("   ")).toEqual([]);
  });
});

describe("bigramSimilarity", () => {
  it("同じ語は 1、まったくちがう語は 0", () => {
    expect(bigramSimilarity("ふぇーど", "ふぇーど")).toBe(1);
    expect(bigramSimilarity("ふぇーど", "おんりょう")).toBe(0);
  });
});

describe("searchOperations", () => {
  it("ひらがなで書いても、カタカナの別名に当たる", () => {
    const hits = searchOperations(OPS, "ふぇーど");
    expect(hits[0]?.op.id).toBe("fade-video");
  });

  it("依頼書の文をそのまま入れても引ける", () => {
    expect(searchOperations(OPS, "フェードしてください")[0]?.op.id).toBe("fade-video");
    expect(searchOperations(OPS, "カットしてください")[0]?.op.id).toBe("blade");
  });

  it("全角の英字でも引ける", () => {
    expect(searchOperations(OPS, "ＢＧＭ")[0]?.op.id).toBe("bgm");
  });

  it("複数の語はすべてに当たるものだけ返す", () => {
    const hits = searchOperations(OPS, "クリップ 音量");
    expect(hits.map((h) => h.op.id)).toEqual(["volume-clip"]);
  });

  it("名前に当たったものを、本文だけに出てくるものより上にする", () => {
    const hits = searchOperations(OPS, "クリップ");
    // どれも手順に「クリップ」を含むが、名前に「クリップ」がある2つが先
    expect(hits.slice(0, 2).map((h) => h.op.id).sort()).toEqual(["blade", "volume-clip"]);
  });

  it("少し書き方がちがっても、似ている名前を拾う", () => {
    expect(searchOperations(OPS, "ふわっとだす")[0]?.op.id).toBe("fade-video");
  });

  it("何も入れないと結果は空", () => {
    expect(searchOperations(OPS, "")).toEqual([]);
  });

  it("どれにも当たらない語では空", () => {
    expect(searchOperations(OPS, "ぜんぜんかんけいない")).toEqual([]);
  });
});
