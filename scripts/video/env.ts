/**
 * ワーカー/CLI用の環境変数ローダー。
 * tsx 直接実行では Next.js と違い .env.local が読まれないため、自前で読み込む。
 * 既に設定済みの環境変数は上書きしない。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").replace(/^﻿/, "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
