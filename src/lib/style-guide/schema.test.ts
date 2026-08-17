import { describe, expect, it } from "vitest";
import {
  coerceHex,
  isHexColor,
  MAX_CHARACTERS,
  normalizeStyleGuide,
} from "./schema";

describe("coerceHex", () => {
  it("妥当なHEXは大文字化して返す", () => {
    expect(coerceHex("#1a2b3c", "#000000")).toBe("#1A2B3C");
  });

  it("前後の空白を除去して判定する", () => {
    expect(coerceHex("  #ffffff  ", "#000000")).toBe("#FFFFFF");
  });

  it("不正な値は fallback を返す", () => {
    expect(coerceHex("red", "#123456")).toBe("#123456");
    expect(coerceHex("#fff", "#123456")).toBe("#123456"); // 3桁は不可
    expect(coerceHex(123, "#123456")).toBe("#123456");
    expect(coerceHex(undefined, "#123456")).toBe("#123456");
  });
});

describe("isHexColor", () => {
  it("#RRGGBB のみ true", () => {
    expect(isHexColor("#00ff88")).toBe(true);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("nope")).toBe(false);
  });
});

describe("normalizeStyleGuide", () => {
  it("空入力でも最低1体のキャラと妥当なHEXを持つ既定ガイドになる", () => {
    const g = normalizeStyleGuide({});
    expect(g.characters.length).toBeGreaterThanOrEqual(1);
    expect(isHexColor(g.palette.background)).toBe(true);
    expect(isHexColor(g.palette.primary)).toBe(true);
    expect(isHexColor(g.palette.accent)).toBe(true);
    expect(isHexColor(g.palette.telopOutline)).toBe(true);
    for (const c of g.characters) {
      expect(isHexColor(c.subtitleColor)).toBe(true);
      expect(Number.isInteger(c.seed)).toBe(true);
      expect(c.seed).toBeGreaterThan(0);
    }
  });

  it("null / 非オブジェクトでも例外にならず既定ガイドを返す", () => {
    expect(() => normalizeStyleGuide(null)).not.toThrow();
    expect(() => normalizeStyleGuide("garbage")).not.toThrow();
    expect(normalizeStyleGuide(undefined).characters.length).toBe(1);
  });

  it("キャラ数は MAX_CHARACTERS で頭打ちにする", () => {
    const many = { characters: Array.from({ length: 10 }, (_, i) => ({ name: `c${i}` })) };
    expect(normalizeStyleGuide(many).characters.length).toBe(MAX_CHARACTERS);
  });

  it("不正なシードは index から決定的に導出する（再現性）", () => {
    const g = normalizeStyleGuide({ characters: [{ name: "A", seed: -5 }, { name: "B", seed: "x" }] });
    expect(g.characters[0].seed).toBe(1007);
    expect(g.characters[1].seed).toBe(2007);
    // 同一入力なら同一シード
    const g2 = normalizeStyleGuide({ characters: [{ name: "A", seed: -5 }, { name: "B", seed: "x" }] });
    expect(g2.characters[0].seed).toBe(g.characters[0].seed);
  });

  it("有効なシードは整数化して保持する", () => {
    const g = normalizeStyleGuide({ characters: [{ name: "A", seed: 42.9 }] });
    expect(g.characters[0].seed).toBe(42);
  });

  it("キャラのkeyは英数字に正規化し重複を一意化する", () => {
    const g = normalizeStyleGuide({
      characters: [
        { key: "アオ 星", name: "アオ" },
        { key: "アオ 星", name: "アオ2" },
      ],
    });
    expect(g.characters[0].key).toBe("char_1"); // 非英数字のみ→既定キー
    expect(g.characters[1].key).not.toBe(g.characters[0].key); // 重複回避
  });

  it("不正なパレット色は既定色に落とす", () => {
    const g = normalizeStyleGuide({ palette: { background: "blue", primary: "#12ab34" } });
    expect(g.palette.background).toBe("#F4F7FB"); // fallback
    expect(g.palette.primary).toBe("#12AB34"); // 有効値は保持
  });

  it("文字列フィールドは空白のみだと既定文に落ちる", () => {
    const g = normalizeStyleGuide({ artStyle: "   ", seriesVoice: "独自トーン" });
    expect(g.artStyle.length).toBeGreaterThan(0);
    expect(g.seriesVoice).toBe("独自トーン");
  });

  it("依頼主(client)ブロックを常に持ち、指定値は保持・欠損は既定に落とす", () => {
    const g = normalizeStyleGuide({ client: { channelName: "たけしの雑学ラボ" } });
    expect(g.client.channelName).toBe("たけしの雑学ラボ"); // 指定値は保持
    expect(g.client.clientName.length).toBeGreaterThan(0); // 欠損は既定
    expect(g.client.persona.length).toBeGreaterThan(0);
    expect(g.client.audience.length).toBeGreaterThan(0);
  });

  it("client未指定でも既定の依頼主が入る", () => {
    const g = normalizeStyleGuide({});
    expect(g.client.channelName.length).toBeGreaterThan(0);
  });
});
