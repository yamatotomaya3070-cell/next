import { describe, expect, it } from "vitest";
import { describeStepFailure, ERROR_MAX_CHARS, isWorkerSilent, tailLines, type StepFailure } from "./stepFailure";

const base: StepFailure = {
  step: "完成見本の書き出し",
  host: "KIZUNA-PC",
  code: 1,
  signal: null,
  stderrTail: [],
  freeMemMB: 2900,
  totalMemMB: 15800,
};

describe("tailLines", () => {
  it("keeps only the last non-empty lines", () => {
    expect(tailLines("a\n\nb\r\nc\n", 2)).toEqual(["b", "c"]);
  });
});

describe("describeStepFailure", () => {
  it("names the step, the PC, the exit code and the last error lines", () => {
    const text = describeStepFailure({ ...base, stderrTail: ["Error: 音声ファイルがありません: S01_01.wav"] });
    expect(text).toContain("【完成見本の書き出し】で止まりました（作業PC: KIZUNA-PC）");
    expect(text).toContain("終了コード 1");
    expect(text).toContain("空きメモリ: 2900MB / 全体 15800MB");
    expect(text).toContain("S01_01.wav");
  });

  it("explains a forced kill instead of an exit code", () => {
    const text = describeStepFailure({ ...base, code: null, signal: "SIGKILL" });
    expect(text).toContain("強制終了されました（SIGKILL）");
    expect(text).toContain("メモリ不足");
    expect(text).not.toContain("終了コード");
  });

  it("explains when the program could not start", () => {
    const text = describeStepFailure({ ...base, code: null, spawnError: "spawn ffmpeg ENOENT" });
    expect(text).toContain("起動できませんでした（spawn ffmpeg ENOENT）");
  });

  it("cuts very long output", () => {
    const text = describeStepFailure({ ...base, stderrTail: ["x".repeat(ERROR_MAX_CHARS * 2)] });
    expect(text.length).toBeLessThan(ERROR_MAX_CHARS + 20);
    expect(text).toContain("以下省略");
  });
});

describe("isWorkerSilent", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  it("is false right after a heartbeat", () => {
    expect(isWorkerSilent("2026-10-19T11:59:00Z", now)).toBe(false);
  });
  it("is true after five missed heartbeats", () => {
    expect(isWorkerSilent("2026-10-19T11:54:00Z", now)).toBe(true);
  });
  it("is false when the job was never locked", () => {
    expect(isWorkerSilent(null, now)).toBe(false);
  });
});
