/**
 * 練習案件の難易度3段階（Stage4）。
 *
 * 同じ台本でも、難易度によって「どこまで手取り足取り教えるか」を変える:
 *  - beginner（やさしい）: 切る候補の理由まで明かし、丁寧な作業指示。許容誤差も大きい。
 *  - intermediate（ふつう）: 切る候補があることは伝えるが判断は任せる。標準的な指示。
 *  - advanced（むずかしい）: 切る候補も明示しない。実案件に近い簡素な指示。許容誤差は小さい。
 *
 * 難易度は台本生成の difficulty（1-5）にもマッピングし、optional の微妙さを連動させる。
 */

export const DIFFICULTY_TIERS = ["beginner", "intermediate", "advanced"] as const;
export type DifficultyTier = (typeof DIFFICULTY_TIERS)[number];

export interface DifficultyProfile {
  tier: DifficultyTier;
  label: string; // 表示用（やさしい 等）
  /** 台本生成に渡す difficulty(1-5)。optional の微妙さに効く */
  scriptDifficulty: number;
  /** 作業指示書で「どのセグメントを切るべきか」を明示するか */
  revealCutTargets: boolean;
  /** 作業指示の詳しさ */
  guidanceDetail: "high" | "medium" | "low";
  /** 完成尺の許容誤差（秒）。機械検品・採点の合否幅に使う */
  toleranceSec: number;
}

const PROFILES: Record<DifficultyTier, DifficultyProfile> = {
  beginner: {
    tier: "beginner",
    label: "やさしい",
    scriptDifficulty: 2,
    revealCutTargets: true,
    guidanceDetail: "high",
    toleranceSec: 15,
  },
  intermediate: {
    tier: "intermediate",
    label: "ふつう",
    scriptDifficulty: 3,
    revealCutTargets: false,
    guidanceDetail: "medium",
    toleranceSec: 10,
  },
  advanced: {
    tier: "advanced",
    label: "むずかしい",
    scriptDifficulty: 4,
    revealCutTargets: false,
    guidanceDetail: "low",
    toleranceSec: 5,
  },
};

/** 不正な値は intermediate（ふつう）にフォールバックする */
export function resolveDifficultyTier(value: unknown): DifficultyProfile {
  return (DIFFICULTY_TIERS as readonly string[]).includes(value as string)
    ? PROFILES[value as DifficultyTier]
    : PROFILES.intermediate;
}

export function difficultyProfile(tier: DifficultyTier): DifficultyProfile {
  return PROFILES[tier];
}

export function allDifficultyProfiles(): DifficultyProfile[] {
  return DIFFICULTY_TIERS.map((t) => PROFILES[t]);
}
