/**
 * 教科書のレッスン用の練習素材（ZIP）を作る。出力は public/guide/practice/*.zip と、
 * サイズの一覧 src/lib/guide/lessons/kits.generated.ts。
 *
 * 使い方（リポジトリの直下で）:
 *   npx tsx scripts/practice/buildPracticeKits.ts [自動で並べる形のパッケージの素材フォルダ] [カット練習パッケージのフォルダ]
 *   既定: テスト用_動画編集パッケージ/03_動画素材/素材  ../テスト用_カット練習パッケージ_新NISA
 *
 * 動画の型は案件と同じ（ハルとミナ先生の解説動画）。声は1セリフずつの音声の前後の無音を落として使う。
 * 録ったままの声（言いよどみ・言い直し入り）は、カット練習パッケージの S01・S05 をそのまま使う。
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VOICE_LEVEL_QUIET } from "../../src/lib/guide/practiceCheck/keys";
import { dbToGain, readWav, trimSilence, writeWav } from "../scene/wav";
import { zipPaths } from "../scene/zipFolder";

const SRC = process.argv[2] ?? "テスト用_動画編集パッケージ/03_動画素材/素材";
const RAW = process.argv[3] ?? "../テスト用_カット練習パッケージ_新NISA";
const OUT = "public/guide/practice";
const WORK = ".tmp_read/practice";
const KITS_TS = "src/lib/guide/lessons/kits.generated.ts";
const RATE = 24000;
const LINE_GAP = 0.25; // 整えた声の、文と文の間（2-3 の目安の 5〜8フレーム）
const BGM = [
  { src: "assets/video/bgm_classroom_body.wav", name: "BGM_A_落ち着いた.wav" },
  { src: "assets/video/bgm_opening.wav", name: "BGM_B_明るい.wav" },
];
const SE_DIR = "assets/se";
const FONT = "C:/Windows/Fonts/YuGothB.ttc";

interface Line {
  speaker: string;
  text: string;
  file: string;
}
interface Scene {
  no: number;
  typeJa: string;
  video: string;
  lines: Line[];
}

// ---------- 素材を読む ----------

function readScenes(): Map<number, Scene> {
  const script = readFileSync(join(RAW, "台本.txt"), "utf8").replace(/^\uFEFF/, "");
  const voices = readdirSync(join(SRC, "音声")).filter((f) => f.endsWith(".wav")).sort();
  const videos = readdirSync(join(SRC, "映像"));
  const scenes = new Map<number, Scene>();
  let cur: Scene | null = null;
  for (const row of script.split(/\r?\n/)) {
    const head = /^■ 場面(\d+)（(.+?)）/.exec(row);
    if (head) {
      const no = Number(head[1]);
      const tag = `S${String(no).padStart(2, "0")}`;
      const video = videos.find((v) => v.startsWith(`${tag}_`));
      if (!video) throw new Error(`${tag} の映像がありません`);
      cur = { no, typeJa: head[2], video, lines: [] };
      scenes.set(no, cur);
      continue;
    }
    const line = /^(.+?)：(.+)$/.exec(row);
    if (cur && line) {
      const tag = `S${String(cur.no).padStart(2, "0")}_${String(cur.lines.length + 1).padStart(2, "0")}_`;
      const file = voices.find((v) => v.startsWith(tag));
      if (!file) throw new Error(`${tag} の声がありません`);
      cur.lines.push({ speaker: line[1], text: line[2], file });
    }
  }
  return scenes;
}

const lineVoice = (l: Line): Float32Array => {
  const pcm = readWav(join(SRC, "音声", l.file));
  if (pcm.rate !== RATE) throw new Error(`${l.file} は ${pcm.rate}Hz（${RATE}Hz を想定）`);
  return trimSilence(pcm.samples, RATE);
};

const silence = (sec: number) => new Float32Array(Math.round(sec * RATE));

function join_(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** セリフを gaps（秒）の間でつなぐ。前後に少し無音を付ける。各セリフの始まり・終わりの秒も返す */
function chain(voices: Float32Array[], gaps: number[], head = 0.2, tail = 0.3) {
  const parts: Float32Array[] = [silence(head)];
  const spans: { start: number; end: number }[] = [];
  let t = head;
  voices.forEach((v, i) => {
    spans.push({ start: t, end: t + v.length / RATE });
    parts.push(v);
    t += v.length / RATE;
    if (i < voices.length - 1) {
      parts.push(silence(gaps[i]));
      t += gaps[i];
    }
  });
  parts.push(silence(tail));
  return { samples: join_(parts), spans, durationSec: t + tail };
}

const sceneVoice = (s: Scene) => chain(s.lines.map(lineVoice), s.lines.map(() => LINE_GAP));

function beep(sec: number): Float32Array {
  const out = silence(sec);
  const fade = Math.round(0.01 * RATE);
  for (let i = 0; i < out.length; i++) {
    const env = Math.min(1, i / fade, (out.length - i) / fade);
    out[i] = 0.25 * env * Math.sin((2 * Math.PI * 1000 * i) / RATE);
  }
  return out;
}

function scale(samples: Float32Array, db: number): Float32Array {
  const g = dbToGain(db);
  return samples.map((v) => v * g);
}

// ---------- 映像 ----------

function ffmpeg(args: string[], cwd?: string): void {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { encoding: "utf8", cwd });
  if (r.status !== 0) throw new Error(`ffmpeg に失敗: ${args.join(" ")}\n${r.stderr}`);
}

function lastFrame(video: string, png: string): void {
  ffmpeg(["-sseof", "-0.2", "-i", video, "-frames:v", "1", "-update", "1", png]);
}

/** 映像（足りなければ最後の画面でのばす）と声を、決まった長さの1本にする */
function segment(video: string, voiceWav: string | null, durSec: number, out: string): void {
  const v = `[0:v]tpad=stop_mode=clone:stop_duration=60,trim=duration=${durSec},setpts=PTS-STARTPTS,fps=24,scale=1280:720,format=yuv420p[v]`;
  const inputs = ["-i", video, ...(voiceWav ? ["-i", voiceWav] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"])];
  const a = `[1:a]apad,atrim=duration=${durSec},aresample=48000,aformat=channel_layouts=stereo[a]`;
  ffmpeg([...inputs, "-filter_complex", `${v};${a}`, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-c:a", "aac", "-b:a", "128k", out]);
}

function concatVideos(parts: string[], out: string): void {
  const list = join(WORK, "concat.txt");
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
}

const assTime = (t: number) => {
  const cs = Math.round(t * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};

/** 字幕を焼き込む（白い文字・黒い縁取り・画面の下） */
function burnSubtitles(video: string, subs: { start: number; end: number; text: string }[], out: string): void {
  const dir = join(WORK, "subs");
  mkdirSync(join(dir, "fonts"), { recursive: true });
  copyFileSync(FONT, join(dir, "fonts", "font.ttc"));
  const ass = [
    "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1280", "PlayResY: 720", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV",
    "Style: Default,Yu Gothic,40,&H00FFFFFF,&H00000000,&H00000000,1,1,3,0,2,60,60,40", "",
    "[Events]", "Format: Layer, Start, End, Style, Text",
    ...subs.map((s) => `Dialogue: 0,${assTime(s.start)},${assTime(s.end)},Default,${s.text}`),
  ].join("\n");
  writeFileSync(join(dir, "subs.ass"), `\uFEFF${ass}`);
  copyFileSync(video, join(dir, "in.mp4"));
  ffmpeg(["-i", "in.mp4", "-vf", "subtitles=subs.ass:fontsdir=fonts", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-c:a", "copy", "out.mp4"], dir);
  copyFileSync(join(dir, "out.mp4"), out);
}

/** 字幕は1行18文字くらいまで。長い文は意味の切れ目（、の後ろ）で2行にし、句読点はスペースにする */
function subtitleText(text: string): string {
  const flat = text.replace(/[。！？!?]+$/u, "").replace(/[、。]/gu, " ").trim();
  if (flat.length <= 18) return flat;
  const mid = flat.length / 2;
  let best = -1;
  for (let i = 0; i < flat.length; i++) if (flat[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best > 0 ? `${flat.slice(0, best)}\\N${flat.slice(best + 1)}` : flat;
}

// ---------- ZIP ----------

interface Kit {
  id: string;
  label: string;
  readme: string[];
  build: (dir: string) => void;
}

function scriptText(title: string, scenes: Scene[]): string {
  return [
    `【台本】${title}`, "", "話す人と、話す言葉（正しい文）です。字幕やテロップの文は、ここから作ります。", "",
    ...scenes.flatMap((s) => [`■ 場面${s.no}（${s.typeJa}）`, ...s.lines.map((l) => `${l.speaker}：${l.text}`), ""]),
  ].join("\r\n");
}

function writeText(file: string, text: string): void {
  writeFileSync(file, `\uFEFF${text}`);
}

function buildKit(kit: Kit): { id: string; file: string; label: string; bytes: number } {
  const dir = join(WORK, kit.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "素材"), { recursive: true });
  kit.build(dir);
  writeText(join(dir, "はじめに.txt"), kit.readme.join("\r\n"));
  const file = `${kit.id}.zip`;
  const paths = readdirSync(dir);
  zipPaths(dir, paths, join(OUT, file));
  return { id: kit.id, file, label: kit.label, bytes: statSync(join(OUT, file)).size };
}

function main(): void {
  for (const p of [SRC, RAW, ...BGM.map((b) => b.src), SE_DIR, FONT]) if (!existsSync(p)) throw new Error(`見つかりません: ${p}`);
  mkdirSync(OUT, { recursive: true });
  mkdirSync(WORK, { recursive: true });
  const scenes = readScenes();
  const sc = (no: number) => {
    const s = scenes.get(no);
    if (!s) throw new Error(`場面${no} がありません`);
    return s;
  };
  const title = "練習：新NISAって結局どうなの？";
  const mk = (dir: string, ...sub: string[]) => {
    for (const s of sub) mkdirSync(join(dir, "素材", s), { recursive: true });
  };
  const video = (name: string) => join(SRC, "映像", name);

  const kits: Kit[] = [
    {
      id: "dv-basics",
      label: "段1の練習素材（30秒）",
      readme: ["段1（1-1〜1-5）の練習素材です。", "", "・素材/映像/S01_会話.mp4 … 場面1の映像", "・素材/音声/S01_声.wav … 場面1の声", "", "1-4 で、映像を V1、声を A1 のいちばん左に置きます。"],
      build: (dir) => {
        mk(dir, "映像", "音声");
        copyFileSync(video(sc(1).video), join(dir, "素材/映像/S01_会話.mp4"));
        writeWav(join(dir, "素材/音声/S01_声.wav"), { rate: RATE, samples: sceneVoice(sc(1)).samples });
      },
    },
    {
      id: "cut-basics",
      label: "2-1 の練習素材（ピーの音が3回入った声）",
      readme: ["2-1「切る・消す・詰める」の練習素材です。", "", "・素材/音声/練習_ピー入り.wav … 場面1の声。セリフの間に「ピー」という音が3回入っています", "", "「ピー」の音だけを3つとも消して、うしろを詰めます。"],
      build: (dir) => {
        mk(dir, "音声");
        const v = sc(1).lines.map(lineVoice);
        const parts: Float32Array[] = [silence(0.3)];
        v.forEach((x, i) => {
          parts.push(x);
          if (i < v.length - 1) parts.push(silence(0.3), beep(0.6), silence(0.3));
        });
        parts.push(silence(0.4));
        writeWav(join(dir, "素材/音声/練習_ピー入り.wav"), { rate: RATE, samples: join_(parts) });
      },
    },
    {
      id: "cut-remove",
      label: "2-2 の練習素材（録ったままの声・約1分）",
      readme: [
        "2-2「「えー」・言い直し・録り始めの声を消す」の練習素材です。", "",
        "・台本.txt … 正しい文。これにない声は消します",
        "・素材/音声/S01_収録.wav … 場面1の、録ったままの声",
        "・素材/音声/S05_収録.wav … 場面5の、録ったままの声", "",
        "録り始めの声、「えー」などの言いよどみ、言いまちがえと言い直しの声が入っています。",
        "長い沈黙は 2-3 で整えるので、ここでは消さなくてかまいません。",
      ],
      build: (dir) => {
        mk(dir, "音声");
        for (const f of ["S01_収録.wav", "S05_収録.wav"]) copyFileSync(join(RAW, "素材/音声", f), join(dir, "素材/音声", f));
        writeText(join(dir, "台本.txt"), scriptText(title, [sc(1), sc(5)]));
      },
    },
    {
      id: "cut-ma",
      label: "2-3 の練習素材（長い沈黙が残った声）",
      readme: [
        "2-3「間（ま）を整える」の練習素材です。", "",
        "・素材/音声/練習_間.wav … 場面2〜4の声。いらない声は消してありますが、長い沈黙が残っています",
        "・台本.txt … どこで話題（場面）が変わるかを見るのに使います", "",
        "文と文の間は 5〜8フレーム、場面が変わる所は 12〜24フレームにそろえます。",
      ],
      build: (dir) => {
        mk(dir, "音声");
        const lines = [sc(2), sc(3), sc(4)].flatMap((s) => s.lines.map((l, i) => ({ v: lineVoice(l), sceneStart: i === 0 })));
        // 長すぎる間（2〜3秒）と、ちょうどよい間をまぜる。場面が変わる所は長めに残っている
        const pattern = [2.4, 0.25, 3.0, 0.3, 2.6, 2.2, 0.25];
        const gaps = lines.slice(1).map((_, i) => pattern[i % pattern.length]);
        writeWav(join(dir, "素材/音声/練習_間.wav"), { rate: RATE, samples: chain(lines.map((l) => l.v), gaps, 0.3, 0.5).samples });
        writeText(join(dir, "台本.txt"), scriptText(title, [sc(2), sc(3), sc(4)]));
      },
    },
    {
      id: "place-video",
      label: "2-4 の練習素材（3場面の映像と声）",
      readme: [
        "2-4「場面の映像を、声に合わせて並べる」の練習素材です。", "",
        "・素材/音声/S01_声.wav〜S03_声.wav … 場面ごとの声（カット済み）",
        "・素材/映像/ … オープニング、場面1〜3の映像、エンディング",
        "・素材/静止画/ … 場面の映像の最後の画面。映像が声より短いときに、のばすのに使います", "",
        "場面2の映像は、声より短くなっています。",
      ],
      build: (dir) => {
        mk(dir, "音声", "映像", "静止画");
        for (const no of [1, 2, 3]) {
          const s = sc(no);
          const tag = `S${String(no).padStart(2, "0")}`;
          const voice = sceneVoice(s);
          writeWav(join(dir, `素材/音声/${tag}_声.wav`), { rate: RATE, samples: voice.samples });
          const dst = join(dir, "素材/映像", s.video);
          if (no === 2) ffmpeg(["-i", video(s.video), "-t", String(Math.max(3, voice.durationSec - 4)), "-c", "copy", dst]);
          else copyFileSync(video(s.video), dst);
          lastFrame(dst, join(dir, `素材/静止画/${tag}_最後の画面.png`));
        }
        for (const f of ["オープニング.mp4", "エンディング.mp4"]) copyFileSync(video(f), join(dir, "素材/映像", f));
      },
    },
    {
      id: "place-character",
      label: "2-5 の練習素材（図の場面と立ち絵）",
      readme: [
        "2-5「解説の場面に立ち絵を重ねる」の練習素材です。", "",
        "・素材/映像/S03_概念図.mp4 … 図の場面の映像",
        "・素材/音声/S03_声.wav … 場面3の声（ミナ先生 → ハルの順に話します）",
        "・素材/立ち絵/ … ミナ先生（mina_）とハル（haru_）の、表情ちがいの画像",
        "・台本.txt … 誰が何を話すか", "",
        "話している人の立ち絵を重ね、表情をセリフに合わせて切りかえます。",
      ],
      build: (dir) => {
        mk(dir, "音声", "映像");
        const s = sc(3);
        copyFileSync(video(s.video), join(dir, "素材/映像", s.video));
        writeWav(join(dir, "素材/音声/S03_声.wav"), { rate: RATE, samples: sceneVoice(s).samples });
        cpSync(join(SRC, "立ち絵"), join(dir, "素材/立ち絵"), { recursive: true });
        writeText(join(dir, "台本.txt"), scriptText(title, [s]));
      },
    },
    {
      id: "sub-practice",
      label: "2-6・2-7 の練習素材（声3本と依頼書）",
      readme: [
        "2-6「字幕を1つ作る」と 2-7「字幕を全部入れて、声に合わせる」の練習素材です。", "",
        "・依頼書.txt … 字幕の見た目の指定",
        "・台本.txt … 字幕の文",
        "・素材/音声/ … セリフの声3本（番号の順に A1 にすき間なく並べます）",
      ],
      build: (dir) => {
        mk(dir, "音声");
        const s = sc(1);
        s.lines.slice(1, 4).forEach((l, i) => {
          writeWav(join(dir, `素材/音声/${String(i + 1).padStart(2, "0")}_${l.speaker}.wav`), { rate: RATE, samples: chain([lineVoice(l)], [], 0.15, 0.2).samples });
        });
        writeText(join(dir, "台本.txt"), scriptText(title, [{ ...s, lines: s.lines.slice(1, 4) }]));
        writeText(join(dir, "依頼書.txt"), [
          "字幕の見た目の指定", "",
          "・フォント：Yu Gothic UI（Mac はヒラギノ角ゴシック）",
          "・大きさ：52",
          "・文字の色：白",
          "・縁取り：黒、太さ 4",
          "・場所：画面の下の真ん中（位置の Y は 90）",
          "・1行は18文字くらいまで、2行まで、句読点なし",
        ].join("\r\n"));
      },
    },
    {
      id: "finish-practice",
      label: "2-8〜2-10 の練習素材（1分の動画・BGM・効果音）",
      readme: [
        "2-8「強調テロップ」・2-9「BGM」・2-10「効果音」の練習素材です。", "",
        "・素材/映像/練習_1分.mp4 … 映像と声が入った約1分の動画（字幕はまだありません）",
        "・素材/BGM/ … BGM の候補2曲（1曲をえらびます）",
        "・素材/効果音/ … 効果音6種類。名前は使いどころの目安です",
        "・台本.txt … 何を話しているか", "",
        "映像は V1、BGM は A2、効果音は A3 に置きます。",
      ],
      build: (dir) => {
        mk(dir, "映像", "BGM", "効果音");
        buildMinuteVideo(join(dir, "素材/映像/練習_1分.mp4"));
        for (const b of BGM) copyFileSync(b.src, join(dir, "素材/BGM", b.name));
        for (const f of readdirSync(SE_DIR).filter((x) => x.endsWith(".wav"))) copyFileSync(join(SE_DIR, f), join(dir, "素材/効果音", f));
        writeText(join(dir, "台本.txt"), scriptText(title, MINUTE_SCENES.map(sc)));
      },
    },
    {
      id: "voice-level",
      label: "2-11 の練習素材（大きさのちがう声）",
      readme: ["2-11「場面ごとの声の大きさをそろえる」の練習素材です。", "", "・素材/音声/S01_声.wav〜S03_声.wav … 場面ごとの声。1つの場面だけ、小さく録れています", "", "番号の順に A1 にすき間なく並べてから、メーターで見ます。"],
      build: (dir) => {
        mk(dir, "音声");
        for (const no of [1, 2, 3]) {
          const v = sceneVoice(sc(no)).samples;
          writeWav(join(dir, `素材/音声/S0${no}_声.wav`), { rate: RATE, samples: no === VOICE_LEVEL_QUIET.scene ? scale(v, VOICE_LEVEL_QUIET.db) : v });
        }
      },
    },
    {
      id: "final-check",
      label: "2-12 の練習素材（誤字が3つある動画）",
      readme: [
        "2-12「誤字を見つけて、見直してから書き出す」の練習素材です。", "",
        "・素材/映像/練習_誤字あり.mp4 … 字幕が入った約1分の動画。字幕に誤字が3つあります",
        "・台本.txt … 正しい文", "",
        "3回読んで誤字を3つ見つけ、どこがどうちがうかをメモ帳に書きます。",
      ],
      build: (dir) => {
        mk(dir, "映像");
        const plain = join(WORK, "minute.mp4");
        const subs = buildMinuteVideo(plain).map((s) => ({ ...s, text: subtitleText(s.text) }));
        for (const [i, from, to] of TYPOS) {
          if (!subs[i].text.includes(from)) throw new Error(`誤字を入れる所が見つかりません: ${subs[i].text} / ${from}`);
          subs[i] = { ...subs[i], text: subs[i].text.replace(from, to) };
        }
        burnSubtitles(plain, subs, join(dir, "素材/映像/練習_誤字あり.mp4"));
        writeText(join(dir, "台本.txt"), scriptText(title, MINUTE_SCENES.map(sc)));
      },
    },
  ];

  // 1分の動画（オープニング → 場面3〜5 → エンディング）。字幕の時間を返す
  const MINUTE_SCENES = [3, 4, 5];
  // [字幕の番号, 正しい字, 誤字]（変換のまちがい・数字・言葉のぬけ）
  const TYPOS: [number, string, string][] = [
    [0, "株式投資", "株式当資"],
    [4, "20%", "2%"],
    [5, "一般口座", "一般講座"],
  ];
  function buildMinuteVideo(out: string): { start: number; end: number; text: string }[] {
    const parts: string[] = [];
    const subs: { start: number; end: number; text: string }[] = [];
    let t = 0;
    const op = join(WORK, "seg_op.mp4");
    segment(video("オープニング.mp4"), null, 3.2, op);
    parts.push(op);
    t += 3.2;
    for (const no of MINUTE_SCENES) {
      const s = sc(no);
      const voice = sceneVoice(s);
      const wav = join(WORK, `seg_${no}.wav`);
      writeWav(wav, { rate: RATE, samples: voice.samples });
      const seg = join(WORK, `seg_${no}.mp4`);
      segment(video(s.video), wav, voice.durationSec, seg);
      parts.push(seg);
      voice.spans.forEach((sp, i) => subs.push({ start: t + sp.start, end: t + sp.end, text: s.lines[i].text }));
      t += voice.durationSec;
    }
    const ed = join(WORK, "seg_ed.mp4");
    segment(video("エンディング.mp4"), null, 7.4, ed);
    parts.push(ed);
    concatVideos(parts.map((p) => join(process.cwd(), p)), out);
    return subs;
  }

  const built = kits.map((k) => {
    const r = buildKit(k);
    console.log(`${r.file}  ${(r.bytes / 1024 / 1024).toFixed(1)}MB`);
    return r;
  });

  const sizeLabel = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(b / 1024)}KB`);
  writeFileSync(
    KITS_TS,
    [
      "// scripts/practice/buildPracticeKits.ts が作るファイル。手で書きかえない。",
      "export const PRACTICE_KITS = {",
      ...built.map((k) => `  "${k.id}": { href: "/guide/practice/${k.file}", label: ${JSON.stringify(k.label)}, size: "${sizeLabel(k.bytes)}" },`),
      "} as const;",
      "",
      "export type PracticeKitId = keyof typeof PRACTICE_KITS;",
      "",
    ].join("\n"),
  );
}

main();
