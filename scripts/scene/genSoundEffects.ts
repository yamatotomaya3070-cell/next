// カット練習の案件で配る効果音を、ffmpeg で音を合成して作る（自分たちで作った音なので、使う決まりの心配がない）。
//   使い方: npx tsx scripts/scene/genSoundEffects.ts   → assets/se/*.wav（あるファイルも作り直す）
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const OUT = "assets/se";

/** ファイル名（受講者が見て、どんな音か分かる名前）→ 長さ（秒）と、音の式（ffmpeg aevalsrc） */
const EFFECTS: { name: string; sec: number; expr: string; filter?: string }[] = [
  { name: "ポン_テロップが出るとき", sec: 0.3, expr: "0.6*sin(2*PI*1046*t)*exp(-t*22)" },
  { name: "ピコン_ポイントを出すとき", sec: 0.45, expr: "0.5*sin(2*PI*(if(lt(t,0.09),1318,1760))*t)*exp(-t*9)" },
  { name: "キラーン_大事な所", sec: 1.2, expr: "0.25*(sin(2*PI*1568*t)+sin(2*PI*2093*t)*exp(-t*1.5)+sin(2*PI*2637*t)*exp(-t*3))*exp(-t*3)" },
  { name: "ジャン_数字や結論", sec: 1.2, expr: "0.22*(sin(2*PI*523*t)+sin(2*PI*659*t)+sin(2*PI*784*t)+0.5*sin(2*PI*1046*t))*exp(-t*2.5)" },
  { name: "ブブー_まちがい", sec: 0.75, expr: "0.3*sgn(sin(2*PI*196*t))*lt(mod(t,0.37),0.27)" , filter: "lowpass=f=1800" },
  // 白い雑音に、だんだん大きく→小さくなる形をかけ、高い音だけ通して「シュッ」にする
  { name: "シュッ_場面がかわるとき", sec: 0.5, expr: "(random(0)*2-1)*0.5*sin(PI*t/0.5)^2", filter: "highpass=f=900,lowpass=f=6000" },
];

function main() {
  mkdirSync(OUT, { recursive: true });
  for (const fx of EFFECTS) {
    const file = `${OUT}/${fx.name}.wav`;
    const filters = [fx.filter, "afade=t=out:st=" + (fx.sec - 0.02).toFixed(2) + ":d=0.02"].filter(Boolean).join(",");
    const r = spawnSync(
      "ffmpeg",
      ["-y", "-v", "error", "-f", "lavfi", "-i", `aevalsrc='${fx.expr}':s=48000:d=${fx.sec}`, "-af", filters, "-ac", "1", "-c:a", "pcm_s16le", file],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`${fx.name} を作れませんでした: ${r.stderr}`);
    console.log(`作成: ${file}`);
  }
}

main();
