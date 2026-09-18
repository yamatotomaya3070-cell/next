/**
 * DaVinci Resolve の「絆_素材を並べる」スクリプト（05_テンプレート/スクリプト/絆_素材を並べる.lua）が
 * タイムラインをどう並べるかを、ファイルを開かずに計算する。
 *
 * 案件を登録する前にこれで並びを予測し、完成見本や作業指示一覧と食い違っていないかを確かめる
 * （scripts/scene/verifyPackage.ts）。スクリプトの間隔や並べ方を変えたら、ここも同じに直すこと。
 *
 * 実機（Resolve 21）で確かめた規則:
 * - クリップのフレーム数: 音声は「秒数×24」を切り捨て、映像は実際のフレーム数
 * - スクリプトは長さ n で置くが、実際にタイムラインに乗る長さは n−1（全部そろって1フレーム短い）
 */

export const FPS = 24;
export const HEAD = 0.4; // 場面の頭の間（秒）
export const GAP = 0.28; // セリフとセリフの間（秒）
export const TAIL = 0.5; // 場面の終わりの間（秒）

export interface ClipInfo {
  name: string;
  /** Resolve が報告するフレーム数 */
  frames: number;
}

export interface PlacedClip {
  name: string;
  start: number; // タイムライン先頭からのフレーム
  length: number; // タイムラインに乗る長さ
}

export interface ArrangeInput {
  voices: ClipInfo[]; // S01_01_話者.wav …
  videos: ClipInfo[]; // S01_会話.mp4 …
  opening: ClipInfo | null;
  ending: ClipInfo | null;
  bgm: ClipInfo | null;
}

export interface ArrangeResult {
  video: PlacedClip[];
  voice: PlacedClip[];
  bgm: { start: number; length: number }[];
  totalFrames: number;
  problems: string[];
}

const placed = (name: string, start: number, frames: number): PlacedClip => ({
  name,
  start,
  length: frames - 1,
});

const sceneNoOf = (name: string) => Number(name.slice(1, 3));
const lineNoOf = (name: string) => Number(name.slice(4, 6));

export function simulateArrange(input: ArrangeInput): ArrangeResult {
  const problems: string[] = [];
  const video: PlacedClip[] = [];
  const voice: PlacedClip[] = [];
  const bgm: { start: number; length: number }[] = [];
  let pos = 0;

  if (input.opening) {
    video.push(placed(input.opening.name, pos, input.opening.frames));
    pos += input.opening.frames;
  }
  const bodyStart = pos;

  const sceneNos = [...new Set(input.voices.map((v) => sceneNoOf(v.name)))].sort((a, b) => a - b);
  for (const no of sceneNos) {
    const lines = input.voices
      .filter((v) => sceneNoOf(v.name) === no)
      .sort((a, b) => lineNoOf(a.name) - lineNoOf(b.name));
    const sceneStart = pos;
    let t = HEAD;
    for (const ln of lines) {
      voice.push(placed(ln.name, sceneStart + Math.round(t * FPS), ln.frames));
      t += ln.frames / FPS + GAP;
    }
    let sceneLen = Math.round((t - GAP + TAIL) * FPS);
    const clip = input.videos.find((v) => sceneNoOf(v.name) === no);
    if (clip) {
      video.push(placed(clip.name, sceneStart, clip.frames));
      if (clip.frames > sceneLen) sceneLen = clip.frames;
    } else {
      problems.push(`S${String(no).padStart(2, "0")} の場面の映像がありません`);
    }
    pos = sceneStart + sceneLen;
  }
  const bodyEnd = pos;

  if (input.bgm) {
    for (let b = bodyStart; b < bodyEnd; ) {
      const len = Math.min(input.bgm.frames, bodyEnd - b);
      bgm.push({ start: b, length: len - 1 });
      b += len;
    }
  } else {
    problems.push("BGM.wav がありません");
  }

  if (input.ending) {
    video.push(placed(input.ending.name, pos, input.ending.frames));
    pos += input.ending.frames;
  }

  // 最後のクリップも1フレーム短く乗るので、タイムラインの長さは pos−1
  return { video, voice, bgm, totalFrames: pos - 1, problems };
}
