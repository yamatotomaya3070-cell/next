/**
 * 教科書（レッスン）の一覧。段0 → 段4 を上から順にやれば、案件を受けて納品できるところまで行く。
 * 案件の「作業のしかた」（workflow.ts）や操作辞典は、ここの slug でレッスンを参照する。
 */
import { STAGE0 } from "./stage0";
import { STAGE1 } from "./stage1";
import { STAGE2_CUT } from "./stage2Cut";
import { STAGE2_FINISH } from "./stage2Finish";
import { STAGE3, STAGE4 } from "./stage34";
import type { Lesson, LessonStage, LessonStageInfo } from "./types";

export type * from "./types";
export { PRACTICE_KITS } from "./kits.generated";

export const LESSON_STAGES: LessonStageInfo[] = [
  { stage: 0, title: "段0 パソコンの基本", summary: "マウス・キー・ファイルの扱いと、アプリからの提出のしかた。" },
  { stage: 1, title: "段1 DaVinci の基本", summary: "30秒の素材で、開く → 入れる → 置く → 再生 → 書き出す を一通りやります。" },
  { stage: 2, title: "段2 1つずつの練習", summary: "カット・配置・字幕・テロップ・BGM・効果音・声を、1つずつ短い素材で練習します。" },
  { stage: 3, title: "段3 組み合わせ", summary: "全部の作業を1本の動画でやります。1分 → 3分 → 5分。ここから職員の方が出来を見ます。" },
  { stage: 4, title: "段4 案件の模擬", summary: "依頼書を読む・質問する・しめきりを守る・修正に応える。実際のお仕事と同じ流れです。" },
];

export const LESSONS: Lesson[] = [...STAGE0, ...STAGE1, ...STAGE2_CUT, ...STAGE2_FINISH, ...STAGE3, ...STAGE4];

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug);
}

export function lessonsOfStage(stage: LessonStage): Lesson[] {
  return LESSONS.filter((l) => l.stage === stage);
}

/** 前後のレッスン（一本道なので、段をまたいで続ける） */
export function neighborLessons(slug: string): { prev: Lesson | null; next: Lesson | null } {
  const i = LESSONS.findIndex((l) => l.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: LESSONS[i - 1] ?? null, next: LESSONS[i + 1] ?? null };
}

/** レッスンのページの URL（basePath は利用者 "/guide"、職員 "/staff/guide"）。無いレッスンは null */
export function lessonHref(basePath: string, slug: string): string | null {
  return getLesson(slug) ? `${basePath}/${slug}` : null;
}

/** リンクに出す名前（"2-1 切る・消す・詰める"） */
export function lessonLabel(slug: string): string | null {
  const l = getLesson(slug);
  return l ? `${l.no} ${l.title}` : null;
}
