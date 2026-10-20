/**
 * 練習の即時チェック。書き出した動画の音（と動画の形）だけで、すぐ結果を返す。
 * 出来の良し悪しではなく「消し残し」「空いたまま」「大きすぎ」など、機械で確かに言えることだけを見る。
 * 答えの数字（keys）は scripts/practice/buildPracticeKeys.ts が配った素材から作る。
 */
import { beepSpans, gapsBetween, levelPercentile, maxPeak, speechLevel, speechSpans, totalSec, type AudioFrames, type Span } from "./analyze";
import type { PracticeKeys } from "./keys";

export type PracticeCheckId = keyof PracticeKeys;

export interface CheckItem {
  ok: boolean;
  text: string;
}

/** 提出できる大きさ（アプリの提出と同じ） */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** 書き出しの長さの、ずれてよい幅（秒） */
const DURATION_TOLERANCE_SEC = 1;

const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const at = (spans: Span[]) => spans.slice(0, 3).map((s) => `${clock(s.start)} ごろ`).join("・");
const sec1 = (v: number) => v.toFixed(1);

export interface VideoInfo {
  width: number;
  height: number;
  durationSec: number;
  bytes: number;
  /** ファイルの中に H.264 の印（avc1）があるか */
  isH264: boolean;
}

/** 1-5：書き出しの設定 */
export function checkExport(video: VideoInfo, frames: AudioFrames, key: PracticeKeys["dv-export"]): CheckItem[] {
  const mb = video.bytes / 1024 / 1024;
  const sizeOk = video.bytes <= MAX_UPLOAD_BYTES;
  const sizeOkay = sizeOk && mb <= key.maxMb;
  return [
    { ok: video.isH264, text: video.isH264 ? "コーデックは H.264 です" : "コーデックが H.264 ではないようです。［コーデック］を「H.264」にえらび直して書き出します" },
    {
      ok: video.width === 1280 && video.height === 720,
      text:
        video.width === 0
          ? "映像が入っていません。V1 に映像を置いて、［ビデオを書き出し］に印が付いているか見直します"
          : video.width === 1280 && video.height === 720
            ? "大きさは 1280 x 720 です"
            : `大きさが ${video.width} x ${video.height} です。［解像度］を 1280 x 720 にします`,
    },
    {
      ok: sizeOkay,
      text: !sizeOk
        ? `ファイルが ${mb.toFixed(0)}MB あり、送れません（50MB まで）。［Bit Rate］を 600 にします`
        : sizeOkay
          ? `ファイルの大きさは ${mb.toFixed(1)}MB です`
          : `ファイルが ${mb.toFixed(1)}MB あり、この長さにしては大きすぎます。［Rate Control］を「固定ビットレート」、［Bit Rate］を 600 にします`,
    },
    {
      ok: Math.abs(video.durationSec - key.durationSec) <= DURATION_TOLERANCE_SEC,
      text:
        Math.abs(video.durationSec - key.durationSec) <= DURATION_TOLERANCE_SEC
          ? `長さは ${sec1(video.durationSec)}秒 です`
          : `長さが ${sec1(video.durationSec)}秒 です（${sec1(key.durationSec)}秒 になるはず）。映像と声を両方、いちばん左に置いたか見直します`,
    },
    {
      ok: maxPeak(frames) > -40,
      text: maxPeak(frames) > -40 ? "音が入っています" : "音が入っていません。声を A1 に置いたか、音を消していないか見直します",
    },
  ];
}

/** 2-1：ピーの音を消して詰める */
export function checkCutBasics(frames: AudioFrames, key: PracticeKeys["cut-basics"]): CheckItem[] {
  const beeps = beepSpans(frames);
  const speech = speechSpans(frames);
  const lost = key.speechSec - totalSec(speech);
  const holes = gapsBetween(speech).filter((g) => g.end - g.start > 1);
  return [
    { ok: beeps.length === 0, text: beeps.length === 0 ? "「ピー」の音は残っていません" : `「ピー」の音が ${beeps.length}つ残っています（${at(beeps)}）` },
    { ok: holes.length === 0, text: holes.length === 0 ? "消した所は詰まっています" : `消した所が空いたままです（${at(holes)}）。うしろを詰めて消します` },
    { ok: lost <= 0.4, text: lost <= 0.4 ? "声は欠けていません" : `声が約${sec1(lost)}秒ぶん短くなっています。言葉まで消していないか聞き直します` },
  ];
}

/** 2-2：「えー」・言い直し・録り始めの声を消す */
export function checkCutRemove(frames: AudioFrames, key: PracticeKeys["cut-remove"]): CheckItem[] {
  const spans = speechSpans(frames);
  const speech = totalSec(spans);
  const firstVoice = spans[0]?.start ?? 0;
  const diff = speech - key.cleanSpeechSec;
  if (diff < -key.cleanSpeechSec * 0.3) {
    return [{ ok: false, text: `声が台本の量よりずっと少ないです。S01 と S05 の両方を並べて書き出したか見直します` }];
  }
  return [
    {
      ok: diff <= key.extraToleranceSec,
      text: diff <= key.extraToleranceSec ? "台本にない声は、ほぼ残っていません" : `台本にない声が、まだ約${sec1(diff)}秒ぶん残っていそうです。録り始め・「えー」・言い直しを聞き直します`,
    },
    {
      ok: diff >= -key.lostToleranceSec,
      text: diff >= -key.lostToleranceSec ? "台本の言葉は、ほぼ残っています" : `声が約${sec1(-diff)}秒ぶん足りません。台本の言葉まで消していないか見直します`,
    },
    {
      ok: firstVoice <= 1,
      text: firstVoice <= 1 ? "最初から、すぐ声が始まります" : `最初の ${sec1(firstVoice)}秒、だまっています。録り始めの所を消します`,
    },
  ];
}

/** 2-3：間を整える */
export function checkCutMa(frames: AudioFrames, key: PracticeKeys["cut-ma"]): CheckItem[] {
  const speech = speechSpans(frames);
  const gaps = gapsBetween(speech);
  const long = gaps.filter((g) => g.end - g.start > 1.05);
  const lost = key.speechSec - totalSec(speech);
  return [
    { ok: long.length === 0, text: long.length === 0 ? "1秒より長くだまっている所はありません" : `1秒より長くだまっている所が ${long.length}か所あります（${at(long)}）` },
    { ok: lost <= 0.4, text: lost <= 0.4 ? "声は欠けていません" : `声が約${sec1(lost)}秒ぶん短くなっています。言葉の頭やおしりを切っていないか聞き直します` },
  ];
}

/** 2-9：BGM */
export function checkBgm(frames: AudioFrames, key: PracticeKeys["bgm"]): CheckItem[] {
  const end = frames.durationSec;
  if (Math.abs(end - key.durationSec) > DURATION_TOLERANCE_SEC) {
    return [{ ok: false, text: `長さが ${sec1(end)}秒 です（${sec1(key.durationSec)}秒 のはず）。練習_1分.mp4 を切らずに、そのまま書き出します` }];
  }
  const opening = levelPercentile(frames, { start: 0.5, end: key.voiceStart - 0.3 }, 0.5);
  const under = levelPercentile(frames, { start: key.voiceStart, end: key.voiceEnd }, 0.1);
  const voice = levelPercentile(frames, { start: key.voiceStart, end: key.voiceEnd }, 0.9);
  const beforeFade = levelPercentile(frames, { start: end - 6, end: end - 5 }, 0.5);
  const fading = levelPercentile(frames, { start: end - 1.6, end: end - 1 }, 0.5);
  const last = levelPercentile(frames, { start: end - 0.3, end }, 0.5);
  const bgm = Math.max(opening, under);
  const hasBgm = bgm > -50;
  if (!hasBgm) return [{ ok: false, text: "BGM が聞こえません。A2 に置いたか、音量を下げすぎていないか見直します" }];
  const ratio = voice - opening;
  const fadeOk = beforeFade - last >= 15 && beforeFade - fading >= 3;
  return [
    {
      ok: opening > -50 && under > -50 && beforeFade > -50,
      text:
        opening <= -50
          ? "最初（オープニング）に BGM が流れていません。いちばん左から置きます"
          : under <= -50 || beforeFade <= -50
            ? "途中で BGM が切れています。曲が短いときは、うしろにもう1つつなげます"
            : "BGM は最初から最後まで流れています",
    },
    {
      ok: ratio >= 10 && ratio <= 35,
      text:
        ratio < 10
          ? `BGM が大きすぎます（声との差が ${ratio.toFixed(0)}dB）。声がはっきり聞こえるまで、音量を下げます`
          : ratio > 35
            ? "BGM が小さすぎて、ほとんど聞こえません。少し上げます"
            : "声のほうが BGM よりはっきり大きいです",
    },
    {
      ok: fadeOk,
      text: fadeOk
        ? "最後はフェードアウトしています"
        : beforeFade - last < 15
          ? "最後がフェードアウトしていません（曲がぶつっと切れます）。クリップの右上の白い印を、2〜3秒ぶん左へ引きます"
          : "フェードアウトが短すぎます。2〜3秒（48〜72フレーム）にします",
    },
  ];
}

/** 2-11：場面ごとの声の大きさをそろえる */
export function checkVoiceLevel(frames: AudioFrames, key: PracticeKeys["voice-level"]): CheckItem[] {
  const total = key.sceneSec.reduce((a, b) => a + b, 0);
  if (Math.abs(frames.durationSec - total) > DURATION_TOLERANCE_SEC) {
    return [{ ok: false, text: `長さが ${sec1(frames.durationSec)}秒 です（${sec1(total)}秒 のはず）。3本を番号の順に、すき間なく並べて書き出します` }];
  }
  let t = 0;
  const scenes = key.sceneSec.map((len, i) => {
    const span = { start: t + 0.1, end: t + len - 0.1 };
    t += len;
    return { no: i + 1, level: speechLevel(frames, speechSpans(frames, span)), peak: maxPeak(frames, span) };
  });
  // 場面1との差を、正しくそろえたときの差と比べる（元の声にも少し差がある）
  const off = scenes.map((s, i) => s.level - scenes[0].level - key.levelDb[i]);
  // 1場面だけ大きすぎるときに、ほかの場面を「小さい」と言わないよう、まん中の値を基準にする
  const ref = [...off].sort((a, b) => a - b)[Math.floor(off.length / 2)];
  const silent = scenes.filter((s) => s.level <= -60);
  if (silent.length > 0) return [{ ok: false, text: `場面${silent.map((s) => s.no).join("・")} に声が入っていません。3本を番号の順に、すき間なく並べて書き出します` }];
  const quiet = scenes.filter((_, i) => ref - off[i] > 2.5).map((s) => ({ ...s, by: ref - off[s.no - 1] }));
  const loud = scenes.filter((_, i) => off[i] - ref > 2.5).map((s) => ({ ...s, by: off[s.no - 1] - ref }));
  const clipped = scenes.filter((s) => s.peak > -0.3);
  const small = scenes.filter((s) => s.peak < -10);
  return [
    {
      ok: quiet.length === 0 && loud.length === 0,
      text:
        quiet.length === 0 && loud.length === 0
          ? "どの場面も、声の大きさがそろっています"
          : [
              ...quiet.map((s) => `場面${s.no} が、ほかより約${s.by.toFixed(0)}dB 小さいです`),
              ...loud.map((s) => `場面${s.no} が、ほかより約${s.by.toFixed(0)}dB 大きいです`),
            ].join("。") + "。［個別］でノーマライズします",
    },
    {
      ok: clipped.length === 0 && small.length === 0,
      text:
        clipped.length > 0
          ? `場面${clipped.map((s) => s.no).join("・")} が大きすぎて、音がわれています。ターゲットレベルを -3 にします`
          : small.length > 0
            ? `場面${small.map((s) => s.no).join("・")} がまだ小さいです（メーターが -10 まで届きません）`
            : "大きすぎ・小さすぎの場面はありません",
    },
  ];
}
