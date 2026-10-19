// 作業PCで1つの工程（node や ffmpeg のスクリプト）を動かす。
// 画面にはそのまま流しつつ、エラー出力の最後の数行を覚えておき、止まったら
// 「どのPCで・どの工程で・なぜ止まったか」をまとめた StepError を投げる。
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { freemem, hostname, totalmem } from "node:os";
import { describeStepFailure, tailLines } from "@/lib/scene/stepFailure";

/** 覚えておくエラー出力の量（最後の行を取り出すのに十分な分だけ） */
const KEEP_CHARS = 20_000;

export class StepError extends Error {}

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** 時刻つきで1行ログに足す。logFile が無ければ何もしない */
export function logLine(logFile: string | undefined, text: string) {
  if (!logFile) return;
  appendFileSync(logFile, `${new Date().toLocaleString("ja-JP")}  ${text}\n`, "utf8");
}

export function runStep(
  step: string,
  cmd: string,
  args: string[],
  opts: { env?: Record<string, string>; logFile?: string } = {},
): Promise<void> {
  logLine(opts.logFile, `開始: ${step}`);
  return new Promise((resolve, reject) => {
    let stderr = "";
    let spawnError: string | undefined;
    const child = spawn(cmd, args, { env: { ...process.env, ...opts.env }, stdio: ["ignore", "inherit", "pipe"] });
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      stderr = (stderr + chunk.toString("utf8")).slice(-KEEP_CHARS);
    });
    child.on("error", (e) => {
      spawnError = e.message;
    });
    child.on("close", (code, signal) => {
      if (code === 0) {
        logLine(opts.logFile, `完了: ${step}`);
        resolve();
        return;
      }
      const message = describeStepFailure({
        step,
        host: hostname(),
        code,
        signal,
        spawnError,
        stderrTail: tailLines(stderr),
        freeMemMB: mb(freemem()),
        totalMemMB: mb(totalmem()),
      });
      logLine(opts.logFile, message);
      reject(new StepError(message));
    });
  });
}
