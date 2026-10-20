/** 即時チェックの答えの数字。値は keys.generated.ts（scripts/practice/buildPracticeKeys.ts が作る） */
export interface PracticeKeys {
  /** 1-5：書き出した動画の長さと、大きさの上限（MB） */
  "dv-export": { durationSec: number; maxMb: number };
  /** 2-1：ピーを消したあとの声の長さ */
  "cut-basics": { speechSec: number };
  /**
   * 2-2：正しく消したときの声の長さ。消し残しは「消す所を1か所だけ残したときに増える声」のいちばん小さい値の6割を超えたら知らせる。
   * 足りない側（言葉まで消した）は、切り方のぶれがあるので幅を広くとる
   */
  "cut-remove": { cleanSpeechSec: number; rawSpeechSec: number; extraToleranceSec: number; lostToleranceSec: number };
  /** 2-3：声の長さ（間を詰めても変わらない） */
  "cut-ma": { speechSec: number };
  /** 2-9：動画の長さと、声が入っている所 */
  bgm: { durationSec: number; voiceStart: number; voiceEnd: number };
  /**
   * 2-11：場面ごとの声の長さ（並べる順）と、正しくそろえたときの声の大きさ（場面1との差、dB）。
   * 元の声も場面ごとに少し大きさがちがうので、0 にそろうとは限らない
   */
  "voice-level": { sceneSec: number[]; levelDb: number[] };
}

/** 2-11 の素材で、小さく録った場面と下げた量（buildPracticeKits.ts が使う） */
export const VOICE_LEVEL_QUIET = { scene: 2, db: -7 } as const;
