import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GEMINI_MODEL } from "../ai/geminiModel";
import { assertAiGenerated, buildMockVideoProject, generateVideoProject } from "./generate";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("generateVideoProject", () => {
  it("キーが無いときは mock を返し、理由を付ける", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const result = await generateVideoProject({ theme: "住民税について" });

    expect(result.provider).toBe("mock");
    expect(result.mockReason).toContain("GEMINI_API_KEY");
  });

  it("Gemini の呼び出しに失敗したときは、失敗の内容を理由に付ける", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("model is no longer available", { status: 404 })));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await generateVideoProject({ theme: "住民税について" });

    expect(result.provider).toBe("mock(fallback)");
    expect(result.mockReason).toContain("404");
  });

  it("GEMINI_MODEL が無いときは、既定のモデルを呼ぶ", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "");
    const fetchMock = vi.fn(async (_url: string) => new Response("x", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await generateVideoProject({ theme: "住民税について" });

    expect(String(fetchMock.mock.calls[0][0])).toContain(`/${DEFAULT_GEMINI_MODEL}:generateContent`);
  });
});

describe("assertAiGenerated", () => {
  const project = buildMockVideoProject({ theme: "住民税について" });

  it("AI で作れた設計図は通す", () => {
    expect(() => assertAiGenerated({ project, provider: "gemini" })).not.toThrow();
  });

  it("mock の設計図は、理由を付けて止める", () => {
    expect(() => assertAiGenerated({ project, provider: "mock(fallback)", mockReason: "Gemini API エラー (404)" })).toThrow(
      /案件を作るのをやめました[\s\S]*Gemini API エラー \(404\)/,
    );
    expect(() => assertAiGenerated({ project, provider: "mock" })).toThrow(/理由: 不明/);
  });
});
