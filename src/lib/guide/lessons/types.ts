/**
 * 教科書のレッスン（はじめて動画編集をする人が、上から順にやれば案件を受けられるようになる一本道）。
 * 要件は docs/教科書の要件_2026-10-20.md。
 *   - 1ページ＝1レッスン＝できるようになること1つ
 *   - 1手順＝1操作。押す所は画面の画像と赤い番号で見せる
 *   - 言葉は初めて出たレッスンで説明する。目安は数字で書く
 *   - Mac で違う所だけ、その手順の中に mac で短く出す（別の道は作らない）
 */
import type { PracticeCheckId } from "../practiceCheck/checks";
import type { PracticeKitId } from "./kits.generated";

export interface GuideMark {
  /** 画像の赤い番号 */
  n: number;
  label: string;
}

/** 「直す前 → 直した後」の例。どこをどう判断するかを具体的に見せる */
export interface GuideExample {
  before: string;
  after: string;
  /** なぜそう直すか */
  why: string;
}

export interface LessonImage {
  src: string;
  alt: string;
  marks?: GuideMark[];
}

export interface LessonStep {
  /** やること（1つの操作） */
  text: string;
  /** 押すキー（Windows） */
  key?: string;
  /** Mac で違うときだけ（キーや画面の違い） */
  mac?: string;
  image?: LessonImage;
}

/** レッスンの中の小さなまとまり（「切る」「消す」など）。手順は1つのまとまりに8つまで */
export interface LessonPart {
  title: string;
  lead?: string;
  steps: LessonStep[];
}

export interface LessonWord {
  term: string;
  meaning: string;
}

export interface LessonPitfall {
  title: string;
  body: string;
}

/** 0〜2 は1つずつ覚える段。3・4 は案件の形で全部をまとめてやる段（出来は職員が見る） */
export type LessonStage = 0 | 1 | 2 | 3 | 4;

export interface Lesson {
  /** URL に使う名前（"pc-mouse" など）。変えるとリンクが切れるので変えない */
  slug: string;
  stage: LessonStage;
  /** 画面に出す番号（"2-1" など） */
  no: string;
  title: string;
  /** この練習でできるようになること（1行） */
  goal: string;
  /** かかる時間の目安（分） */
  minutes: number;
  /** 練習に使う素材の説明 */
  material?: string;
  /** 練習素材の ZIP（scripts/practice/buildPracticeKits.ts で作る） */
  kit?: PracticeKitId;
  /** 書き出した動画を、その場で機械で確かめる（practiceCheck/checks.ts）。音で見られるレッスンだけ */
  autoCheck?: PracticeCheckId;
  /** このレッスンで初めて出る言葉 */
  words?: LessonWord[];
  parts: LessonPart[];
  /** 判断の目安（数字で） */
  rules?: string[];
  examples?: GuideExample[];
  pitfalls?: LessonPitfall[];
  /** できたか確かめる（3つまで） */
  checks: string[];
  /** くわしい操作を辞典で見る（operations.ts の id） */
  ops?: string[];
}

export interface LessonStageInfo {
  stage: LessonStage;
  title: string;
  summary: string;
}
