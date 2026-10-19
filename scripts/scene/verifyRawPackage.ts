// カット練習の形のパッケージを登録する前の関門（registerSceneTask の最初で呼ぶ）。
// 合わない所が1つでもあれば例外を投げ、案件は登録されない。
//
// 確かめること
//   1. 配る物がそろっている（台本・はじめに・場面ごとの声と映像・BGM・効果音・完成見本）
//   2. 答え（編集ポイント.json）のセリフが、台本のセリフと1対1で合っている
//   3. 消す所が録った声の長さの中にあり、言いよどみ・言い直し・長い沈黙が最低限の数だけある
//   4. 声がわれていない（ピークが -1dBFS 以下）
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { MIN_COUNTS } from "@/lib/scene/rawTakes";
import type { EditKey, RawManifest } from "./buildRawPackage";
import { readWav } from "./wav";

const MAX_PEAK = 10 ** (-1 / 20);

export interface RawCheck {
  scenes: number;
  rawSec: number;
  cuts: number;
}

export function verifyRawPackage(dir: string): RawCheck {
  const problems: string[] = [];
  const need = (path: string) => {
    if (!existsSync(`${dir}/${path}`)) problems.push(`${path} がありません`);
  };
  ["台本.txt", "はじめに.txt", "完成見本.mp4", "素材一覧.json", "編集ポイント.json", "app_task.json"].forEach(need);
  if (problems.length) throw new Error(`カット練習の素材が足りません: ${problems.join(" / ")}`);

  const m = JSON.parse(readFileSync(`${dir}/素材一覧.json`, "utf8")) as RawManifest;
  const key = JSON.parse(readFileSync(`${dir}/編集ポイント.json`, "utf8")) as EditKey;
  const count = (sub: string) => (existsSync(`${dir}/${sub}`) ? readdirSync(`${dir}/${sub}`).length : 0);
  if (count("素材/BGM") === 0) problems.push("BGM がありません");
  if (count("素材/効果音") === 0) problems.push("効果音がありません");
  if (key.scenes.length !== m.scenes.length) problems.push(`答えの場面数 ${key.scenes.length} と素材の場面数 ${m.scenes.length} がちがいます`);

  m.scenes.forEach((s, i) => {
    need(s.audio);
    need(s.video);
    const k = key.scenes[i];
    if (!k) return;
    const texts = k.kept.map((x) => x.text);
    if (texts.join("\n") !== s.lines.map((l) => l.text).join("\n")) problems.push(`場面${s.no}：答えのセリフが台本と合いません`);
    for (const c of k.cuts) {
      if (c.startSec < 0 || c.endSec > k.durationSec + 1e-3 || c.endSec <= c.startSec) problems.push(`場面${s.no}：消す所 ${c.startSec}〜${c.endSec}秒 が録った声の外です`);
    }
    if (existsSync(`${dir}/${s.audio}`)) {
      const { samples } = readWav(`${dir}/${s.audio}`);
      let peak = 0;
      for (const v of samples) peak = Math.max(peak, Math.abs(v));
      if (peak > MAX_PEAK) problems.push(`場面${s.no}：声がわれています（ピーク ${(20 * Math.log10(peak)).toFixed(1)}dB）`);
    }
  });

  const total = (kind: string) => key.scenes.reduce((n, s) => n + s.cuts.filter((c) => c.kind === kind).length, 0);
  if (total("filler") < MIN_COUNTS.filler) problems.push("言いよどみが少なすぎます");
  if (total("retake") < MIN_COUNTS.retake) problems.push("言い直しが少なすぎます");
  if (total("long_gap") < MIN_COUNTS.long_gap) problems.push("長い沈黙が少なすぎます");

  if (problems.length) throw new Error(`カット練習の素材に合わない所があります:\n- ${problems.join("\n- ")}`);
  return {
    scenes: m.scenes.length,
    rawSec: +key.scenes.reduce((n, s) => n + s.durationSec, 0).toFixed(1),
    cuts: key.scenes.reduce((n, s) => n + s.cuts.length, 0),
  };
}
