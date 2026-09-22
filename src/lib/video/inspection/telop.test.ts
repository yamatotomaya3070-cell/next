import { describe, expect, test } from "vitest";
import {
  checkTelops,
  judgeTelop,
  normalizeTelop,
  parseTelopExpectations,
  telopSimilarity,
  type TelopObservation,
} from "./telop";

const CSV = `﻿"シーン","セクション","演者","セリフ","映像タイプ","図解・映像素材名","音声素材名","立ち絵素材名","強調テロップ","空ける間(フレーム)","補足"
"S1","導入","ナレーション","【超入門】ハルと学ぶ！","会話","素材/映像/S01_会話.mp4","素材/音声/S01_01_ナレーション.wav","","新NISAって、結局お得？","","補足, カンマ入り"
"S1","","ミナ先生","皆さん、こんにちは！","","","素材/音声/S01_02_ミナ先生.wav","mina","","",""
"S2","図解","","","数字アニメ","素材/映像/S02_数字.mp4","","","利益100万円","",""`;

const MD = `## 作業指示一覧

| 順番 | 話す人 | 使う音声 | セリフ（字幕の文） | 強調テロップ |
|---|---|---|---|---|
| 1-1 | ナレーション | S01_01_ナレーション.wav | 【超入門】ハルと学ぶ！ | 「新NISA」ここから場面の終わりまで |
| 1-2 | ミナ先生 | S01_02_ミナ先生.wav | 皆さん、こんにちは！ |  |`;

describe("parseTelopExpectations", () => {
  test("CSV から音声ファイル→字幕の文を取り出し、音声の無い行は無視する", () => {
    const rows = parseTelopExpectations(CSV);
    expect(rows).toEqual([
      { voiceFile: "S01_01_ナレーション.wav", text: "【超入門】ハルと学ぶ！" },
      { voiceFile: "S01_02_ミナ先生.wav", text: "皆さん、こんにちは！" },
    ]);
  });

  test("Markdown 表（timelineMd）からも同じものが取れる", () => {
    expect(parseTelopExpectations(MD)).toEqual(parseTelopExpectations(CSV));
  });

  test("どちらの形でもなければ空", () => {
    expect(parseTelopExpectations("ただの文章")).toEqual([]);
  });
});

describe("normalizeTelop / telopSimilarity", () => {
  test("句読点・空白・全角半角の違いは無視する", () => {
    expect(normalizeTelop("皆さん、こんにちは！ ＮＩＳＡ")).toBe("皆さんこんにちはnisa");
    expect(telopSimilarity("皆さん、こんにちは！", "皆さん こんにちは")).toBe(1);
  });

  test("1文字の読み間違いは高い類似度、別の文は低い類似度", () => {
    expect(telopSimilarity("新NISAって結局何？", "新NlSAって結局何？")).toBeGreaterThan(0.85);
    expect(telopSimilarity("新NISAって結局何？", "ハルです！今日もよろしく")).toBeLessThan(0.5);
  });
});

function obs(partial: Partial<TelopObservation> & { voiceFile: string }): TelopObservation {
  return { expected: "皆さん、こんにちは！", submissionStartSec: 10, ocrTexts: ["皆さん、こんにちは！"], ...partial };
}

describe("judgeTelop", () => {
  test("複数フレームのうち一番近いものを採用し、話者ラベルの混入は取り除く", () => {
    const j = judgeTelop(obs({ voiceFile: "S01_02_ミナ先生.wav", ocrTexts: ["", "ミナ先生 皆さん、こんにちは！"] }));
    expect(j.verdict).toBe("match");
    expect(j.bestOcr).toBe("皆さん、こんにちは！");
  });

  test("どのフレームにも文字が無ければ missing", () => {
    expect(judgeTelop(obs({ voiceFile: "S01_02_ミナ先生.wav", ocrTexts: ["", "  "] })).verdict).toBe("missing");
  });

  test("別の文なら wrong、少し違うだけなら doubtful", () => {
    expect(judgeTelop(obs({ voiceFile: "S01_02_ミナ先生.wav", ocrTexts: ["ハルです！今日もよろしく"] })).verdict).toBe("wrong");
    expect(judgeTelop(obs({ voiceFile: "S01_02_ミナ先生.wav", ocrTexts: ["皆さん、こんばんは？です"] })).verdict).toBe("doubtful");
  });
});

describe("checkTelops", () => {
  test("全部一致なら2項目 pass", () => {
    const items = checkTelops([obs({ voiceFile: "S01_02_ミナ先生.wav" }), obs({ voiceFile: "S01_03_ハル.wav" })]);
    expect(items.map((c) => c.status)).toEqual(["pass", "pass"]);
  });

  test("字幕が無いセリフがあれば入れ忘れ fail、文言違いがあれば字幕の文 fail", () => {
    const items = checkTelops([
      obs({ voiceFile: "S01_02_ミナ先生.wav", ocrTexts: [""], submissionStartSec: 155 }),
      obs({ voiceFile: "S01_03_ハル.wav", ocrTexts: ["まったく別の文です"] }),
    ]);
    const present = items[0];
    const text = items[1];
    expect(present.status).toBe("fail");
    expect(present.message).toContain("S01_02（ミナ先生）: 2分35秒あたり");
    expect(text.status).toBe("fail");
    expect(text.actual).toContain("S01_03（ハル）「まったく別の文です」");
  });

  test("微妙な違いだけなら字幕の文は unknown（職員確認）で、差し戻し文言は付けない", () => {
    const items = checkTelops([obs({ voiceFile: "S01_02_ミナ先生.wav", ocrTexts: ["皆さん、こんばんは？です"] })]);
    expect(items[1].status).toBe("unknown");
    expect(items[1].message).toBeUndefined();
  });

  test("観測が無ければ unknown", () => {
    expect(checkTelops([]).map((c) => c.status)).toEqual(["unknown", "unknown"]);
  });
});

describe("telopSimilarity の先頭一致", () => {
  test("見本側で「…」と省略された長い字幕は、十分な長さの先頭が一致すれば同じ文", () => {
    const expected = "はい、これは、税金の計算のもとになる所得から、iDeCoの掛金分を引いてくれる、という意味です。例えば年収500万円の人が毎月2万円を積み立てたら、年間で約3万6千円も税金が軽くなるんですよ！";
    const ocr = "はい、これは、税金の計算のもとになる所得から、iDeCoの掛金分を引いてくれる、という意味です。例えば年収500万円の人が毎月2万円を積み立てたら、年間…";
    expect(telopSimilarity(expected, ocr)).toBe(1);
  });

  test("短い文どうしや、先頭が同じだけの短い読み取りには適用しない", () => {
    expect(telopSimilarity("はい、これは税金の話です", "はい")).toBeLessThan(0.5);
    expect(telopSimilarity("はい。", "はい、これは、税金の計算のもとになる所得から")).toBeLessThan(0.5);
  });
});
