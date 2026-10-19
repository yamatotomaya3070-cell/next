/**
 * カット練習用の「録ったままの声」の組み立て方を決める。
 *
 * 実案件では、届く声は1本の長い収録データで、録り始めの沈黙・「えー」・言い直し・長い間が入っている。
 * 受講者はそれを切って聞きやすくする（教科書 第12章）。ここでは、きれいなセリフ音声の並びに
 * そうした「消す所」をわざと混ぜる計画を作る。音声ファイルを組み立てるのは scripts/scene/buildRawPackage.ts。
 *
 * 同じ案件からは同じ計画ができるように、乱数は案件ごとの種（seed）から作る。
 * 消す所は「答え」として記録し、提出動画の検品（消し残しがないか）に使う。
 */

export type NgSpeaker = "narrator" | "haru" | "mina";
export const NG_SPEAKERS: NgSpeaker[] = ["narrator", "haru", "mina"];

export type NgClipId =
  | "filler_ee"
  | "filler_eto"
  | "filler_ano"
  | "filler_maa"
  | "cue_sorry"
  | "cue_mistake"
  | "cue_redo"
  | "start"
  | "ok";

export interface NgClip {
  id: NgClipId;
  text: string;
  /** 声の出し方（音声合成への指示） */
  how: string;
}

export const NG_CLIPS: NgClip[] = [
  { id: "filler_ee", text: "えー", how: "言葉につまって、短く言いよどみました" },
  { id: "filler_eto", text: "えーっと", how: "次の言葉を思い出しながら、言いよどみました" },
  { id: "filler_ano", text: "あのー", how: "話し始める前に、少し言いよどみました" },
  { id: "filler_maa", text: "まあ", how: "話し始める前の口ぐせとして、軽く言いました" },
  { id: "cue_sorry", text: "あ、すみません。もう一回いきます。", how: "言いまちがえてしまい、言い直す前に小さめの声で言いました" },
  { id: "cue_mistake", text: "あっ、まちがえました。", how: "言いまちがえに気づいて、思わず言いました" },
  { id: "cue_redo", text: "ちょっと言い直します。", how: "言いまちがえたので、言い直す前に言いました" },
  { id: "start", text: "はい、じゃあ、始めます。", how: "録音を始める合図として、本番の前に言いました" },
  { id: "ok", text: "はい、オッケーです。", how: "録音を終える合図として、本番のあとに言いました" },
];

const FILLERS: NgClipId[] = ["filler_ee", "filler_eto", "filler_ano", "filler_maa"];
const CUES: NgClipId[] = ["cue_sorry", "cue_mistake", "cue_redo"];

export const ngClipFile = (speaker: NgSpeaker, id: NgClipId) => `${speaker}_${id}.wav`;

export function asNgSpeaker(speaker: string): NgSpeaker {
  return (NG_SPEAKERS as string[]).includes(speaker) ? (speaker as NgSpeaker) : "narrator";
}

/** 消す所の種類（答えの記録と、検品の文に使う） */
export type CutKind = "lead" | "tail" | "long_gap" | "filler" | "retake" | "start_cue" | "end_cue";

export const CUT_KIND_JA: Record<CutKind, string> = {
  lead: "録り始めの沈黙",
  tail: "録り終わりの沈黙",
  long_gap: "長い沈黙",
  filler: "「えー」などの言いよどみ",
  retake: "言いまちがえと言い直しの声",
  start_cue: "録り始めの声と沈黙",
  end_cue: "録り終わりの声と沈黙",
};

export type Segment =
  | { kind: "silence"; sec: number; cut?: CutKind }
  | { kind: "line"; li: number }
  /** セリフ li の頭から ratio の所までで言葉が止まる（言いまちがえ） */
  | { kind: "flub"; li: number; ratio: number }
  | { kind: "ng"; clip: NgClipId; speaker: NgSpeaker; cut: CutKind };

export interface RawLineInput {
  speaker: string;
  durSec: number;
}

export interface RawScenePlan {
  segments: Segment[];
  /** 場面全体の音量の上げ下げ（dB）。1場面だけ小さく録れている設定にして、声をそろえる練習にする */
  gainDb: number;
}

/** 長い沈黙のうち、残してよい長さ（これより長い分が「消す所」） */
export const KEEP_GAP_SEC = 0.5;

/** 最低限入れる数（短い動画でも、カットの練習になるように） */
export const MIN_COUNTS = { filler: 3, retake: 2, long_gap: 2 } as const;

const QUIET_GAIN_DB = -7;

/** 案件ごとに決まる乱数（mulberry32） */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rnd: () => number, lo: number, hi: number) => +(lo + (hi - lo) * rnd()).toFixed(2);
const pick = <T>(rnd: () => number, xs: T[]): T => xs[Math.floor(rnd() * xs.length)];

interface LineChoice {
  filler: boolean;
  retake: boolean;
  longGap: boolean;
}

/** セリフごとに、言いよどみ・言い直し・長い沈黙を入れるかを決める */
function chooseLines(scenes: RawLineInput[][], rnd: () => number): LineChoice[][] {
  const choices = scenes.map((lines) =>
    lines.map((ln, li) => ({
      filler: rnd() < 0.28,
      // 短すぎるセリフは、途中で止めても言いまちがえに聞こえない
      retake: ln.durSec >= 2 && rnd() < 0.12,
      longGap: li > 0 && rnd() < 0.18,
    })),
  );
  // 足りない分は、まだ入っていないセリフに前から順に足す（乱数で選んだ位置から回す）
  const flat = choices.flatMap((cs, si) => cs.map((c, li) => ({ c, ln: scenes[si][li], li })));
  const ensure = (key: keyof LineChoice, min: number, ok: (x: (typeof flat)[number]) => boolean) => {
    const eligible = flat.filter(ok);
    if (eligible.length === 0) return;
    let have = flat.filter((x) => x.c[key]).length;
    const start = Math.floor(rnd() * eligible.length);
    for (let i = 0; i < eligible.length && have < min; i++) {
      const x = eligible[(start + i) % eligible.length];
      if (!x.c[key]) {
        x.c[key] = true;
        have++;
      }
    }
  };
  ensure("filler", MIN_COUNTS.filler, () => true);
  ensure("retake", MIN_COUNTS.retake, (x) => x.ln.durSec >= 2);
  ensure("longGap", MIN_COUNTS.long_gap, (x) => x.li > 0);
  return choices;
}

/**
 * 全場面の「録ったままの声」の計画を作る。
 * scenes: 場面ごとのセリフ（話す人と長さ）。seed: 案件ID など。
 */
export function planRawTakes(scenes: RawLineInput[][], seed: string): RawScenePlan[] {
  const rnd = seededRandom(seed);
  const choices = chooseLines(scenes, rnd);
  // 1場面だけ小さく録れている（3場面以上あるとき。最初の場面は避ける）
  const quiet = scenes.length >= 3 ? 1 + Math.floor(rnd() * (scenes.length - 1)) : -1;

  return scenes.map((lines, si) => {
    const segments: Segment[] = [];
    const first = asNgSpeaker(lines[0]?.speaker ?? "narrator");
    const last = asNgSpeaker(lines[lines.length - 1]?.speaker ?? "narrator");

    segments.push({ kind: "silence", sec: between(rnd, 1.2, 2.4), cut: "lead" });
    if (si === 0) {
      segments.push({ kind: "ng", clip: "start", speaker: first, cut: "start_cue" });
      segments.push({ kind: "silence", sec: between(rnd, 1.0, 1.6), cut: "lead" });
    }

    lines.forEach((ln, li) => {
      const c = choices[si][li];
      const speaker = asNgSpeaker(ln.speaker);
      if (li > 0) {
        segments.push(
          c.longGap
            ? { kind: "silence", sec: between(rnd, 1.8, 3.2), cut: "long_gap" }
            : { kind: "silence", sec: between(rnd, 0.3, 0.5) },
        );
      }
      if (c.filler) {
        segments.push({ kind: "ng", clip: pick(rnd, FILLERS), speaker, cut: "filler" });
        segments.push({ kind: "silence", sec: between(rnd, 0.15, 0.35), cut: "filler" });
      }
      if (c.retake) {
        segments.push({ kind: "flub", li, ratio: between(rnd, 0.4, 0.6) });
        segments.push({ kind: "silence", sec: between(rnd, 0.25, 0.4), cut: "retake" });
        segments.push({ kind: "ng", clip: pick(rnd, CUES), speaker, cut: "retake" });
        segments.push({ kind: "silence", sec: between(rnd, 0.6, 1.0), cut: "retake" });
      }
      segments.push({ kind: "line", li });
    });

    segments.push({ kind: "silence", sec: between(rnd, 1.5, 2.6), cut: "tail" });
    if (si === scenes.length - 1) {
      segments.push({ kind: "ng", clip: "ok", speaker: last, cut: "end_cue" });
      segments.push({ kind: "silence", sec: between(rnd, 0.8, 1.2), cut: "tail" });
    }
    return { segments, gainDb: si === quiet ? QUIET_GAIN_DB : 0 };
  });
}

/** 組み立てたあとの、1つの区間（秒） */
export interface PlacedSegment {
  segment: Segment;
  startSec: number;
  endSec: number;
}

export interface CutRegion {
  kind: CutKind;
  startSec: number;
  endSec: number;
}

export interface KeptLine {
  li: number;
  startSec: number;
  endSec: number;
}

/**
 * 組み立てた区間から「消す所」と「残すセリフ」を取り出す（答えの記録）。
 * 続いた同じ種類の区間は1つにまとめる。長い沈黙は KEEP_GAP_SEC を残した残りだけを消す所にする。
 */
export function cutRegions(placed: PlacedSegment[]): { cuts: CutRegion[]; kept: KeptLine[] } {
  const cuts: CutRegion[] = [];
  const kept: KeptLine[] = [];
  for (const p of placed) {
    const s = p.segment;
    if (s.kind === "line") {
      kept.push({ li: s.li, startSec: p.startSec, endSec: p.endSec });
      continue;
    }
    const kind: CutKind | undefined = s.kind === "flub" ? "retake" : s.cut;
    if (!kind) continue; // ふつうの間（残す）
    const trim = kind === "long_gap" ? KEEP_GAP_SEC / 2 : 0;
    const region = { kind, startSec: round3(p.startSec + trim), endSec: round3(p.endSec - trim) };
    const prev = cuts[cuts.length - 1];
    // 言いよどみ・言い直しのあとの短い沈黙や、録り始めの沈黙と声は、ひとかたまりにする
    if (prev && prev.endSec === region.startSec && GROUP[prev.kind] === GROUP[kind]) {
      prev.endSec = region.endSec;
      // 沈黙と声がひとかたまりになったら、声のほうの名前にする（「沈黙」とだけ書くと、声が入っているのに気づけない）
      if (kind === "start_cue" || kind === "end_cue") prev.kind = kind;
    } else cuts.push(region);
  }
  return { cuts, kept };
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** つながっていれば1つにまとめる組 */
const GROUP: Record<CutKind, string> = {
  lead: "head",
  start_cue: "head",
  tail: "end",
  end_cue: "end",
  long_gap: "gap",
  filler: "filler",
  retake: "retake",
};

/** わざと入れた「消す声」1つ（言いよどみ・言い直しの声・録り始め／終わりの声）。検品で、提出に残っていないかを探す */
export interface NgVoiceRegion {
  kind: CutKind;
  clip: NgClipId;
  speaker: NgSpeaker;
  startSec: number;
  endSec: number;
}

/** 組み立てた区間から、わざと入れた声だけを取り出す（言いまちがえて止まった声は、正しいセリフの頭と同じ音なので入れない） */
export function ngVoiceRegions(placed: PlacedSegment[]): NgVoiceRegion[] {
  return placed.flatMap((p) =>
    p.segment.kind === "ng"
      ? [{ kind: p.segment.cut, clip: p.segment.clip, speaker: p.segment.speaker, startSec: round3(p.startSec), endSec: round3(p.endSec) }]
      : [],
  );
}
