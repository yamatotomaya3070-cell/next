/**
 * DaVinci Resolve の「絆_素材を並べる」スクリプト（05_テンプレート/スクリプト/絆_素材を並べる.lua）が
 * タイムラインをどう並べるかを、ファイルを開かずに計算する。
 *
 * 案件を登録する前にこれで並びを予測し、完成見本や作業指示一覧と食い違っていないかを確かめる
 * （scripts/scene/verifyPackage.ts）。スクリプトの間隔や並べ方を変えたら、ここも同じに直すこと。
 *
 * 実機（Resolve 21）で確かめた規則:
 * - クリップのフレーム数: 音声は「秒数×24」を切り捨て、映像は実際のフレーム数
 * - AppendToTimeline の endFrame は「含まない」。endFrame = n で n フレーム乗る
 *   （以前は n−1 を渡して全部1フレーム短く乗り、つなぎ目に黒い1フレームが出ていた）
 *
 * セリフの置き場所はフレームの整数で決める。完成見本（poc/scene/timing.mjs の frameSchedule）と同じ式。
 */

export const FPS = 24;
export const HEAD_F = 10; // 場面の頭の間（フレーム）
export const GAP_F = 7; // セリフとセリフの間（フレーム）
export const TAIL_F = 12; // 場面の終わりの間（フレーム）

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
  length: frames,
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
    let cur = HEAD_F;
    let lastEnd = 0;
    for (const ln of lines) {
      voice.push(placed(ln.name, sceneStart + cur, ln.frames));
      lastEnd = cur + ln.frames;
      cur = lastEnd + GAP_F;
    }
    let sceneLen = lastEnd + TAIL_F;
    const clip = input.videos.find((v) => sceneNoOf(v.name) === no);
    if (clip) {
      video.push(placed(clip.name, sceneStart, clip.frames));
      // 映像がセリフより短いと、次の場面までの間が黒くなる（完成見本とも合わない）
      if (clip.frames < sceneLen) {
        problems.push(`S${String(no).padStart(2, "0")} の場面の映像が ${sceneLen - clip.frames}フレーム足りません`);
      }
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
      bgm.push({ start: b, length: len });
      b += len;
    }
  } else {
    problems.push("BGM.wav がありません");
  }

  if (input.ending) {
    video.push(placed(input.ending.name, pos, input.ending.frames));
    pos += input.ending.frames;
  }

  return { video, voice, bgm, totalFrames: pos, problems };
}
