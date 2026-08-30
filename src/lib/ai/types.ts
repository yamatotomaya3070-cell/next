import type { FeedbackCriterion, ManualStep, SelfCheckItem } from "@/lib/types";
import type { StyleGuideContent } from "@/lib/style-guide/schema";
import type { GeneratedPracticeScript } from "@/lib/practice-script/schema";

/**
 * スタイルガイド案の生成リクエスト。テーマは未定で構わない。
 * 建前＝「1人のYouTuberから長期的に編集を請け負う」ため、
 * 担当チャンネルの方向性（brief）から複数案を提案し、管理者が選択・編集・確定する。
 */
export interface ProposeStyleGuidesInput {
  brief: string; // 管理者が伝えるチャンネルの方向性（自由記述。空でも可）
  characterCount?: number; // 希望キャラ数（1-4）。未指定なら2
  count?: number; // 提案数（既定3）
}

/** スタイルガイド案（複数提案。中身は StyleGuideContent） */
export interface StyleGuideProposal {
  guides: StyleGuideContent[];
}

/** 練習教材の生成リクエスト */
export interface GenerateTaskInput {
  theme: string; // 例: 「料理動画にテロップを入れる」
  difficulty: number; // 1-5
  skillTags: string[]; // 例: ['telop', 'script']
  genre?: string; // 動画ジャンル（例: 'YouTube解説', 'TikTokショート', '商品紹介'）。未指定ならテーマから推定
  traineeNote?: string; // 利用者特性に合わせた調整メモ（任意）
  knowledgeContext?: string; // 蓄積済み実案件ナレッジの要約（依頼傾向・注意事項）
  editingPatternContext?: string; // 実案件動画から学習した編集パターン（Loop A。editingPatternToPromptBlockの出力）
  manualGuidelinesContext?: string; // 作業手順の必守ルール（manual_guidelines。過去の修正から学習。buildManualGuidelinesContextの出力）
}

/** 練習教材の生成結果 */
export interface GeneratedTask {
  title: string;
  summary: string;
  estimatedMinutes: number;
  dueInDays: number;
  requestDoc: string; // 模擬依頼書（生テキスト、ふりがなは付けない）
  manualSteps: ManualStep[]; // 手順書（一工程ずつ）
  script: string | null; // 字幕用台本（テロップ課題のみ）
  selfCheckItems: string[]; // 納品前セルフチェック項目
}

/** 実案件テキストから類似模擬案件を生成するリクエスト */
export interface GenerateSimilarCaseInput {
  rawCaseText: string; // クラウドワークス等の依頼文（コピペ or メール本文）
  difficulty?: number; // 1-5。未指定なら実案件から推定
  traineeNote?: string; // 利用者特性に合わせた調整メモ（任意）
  referenceSnippets?: string[]; // RAG: 過去の匿名化済み類似案件の抜粋（match_case_documents の結果）
  editingPatternContext?: string; // 実案件動画から学習した編集パターン（Loop A。editingPatternToPromptBlockの出力）
  manualGuidelinesContext?: string; // 作業手順の必守ルール（manual_guidelines。過去の修正から学習）
}

/** 匿名化レポート（職員承認画面に表示する） */
export interface MaskingReport {
  removedItems: string[]; // 例: 「企業名『〇〇株式会社』→『依頼者』に置換」
  riskNotes: string[]; // 匿名化しきれない可能性があり職員確認が必要な点
}

/** 実案件由来の模擬案件一式（依頼書・手順書・台本・修正指示・完成見本説明） */
export interface GeneratedSimilarCase extends GeneratedTask {
  genre: string; // 例: 'vlog' | 'ad' | 'subtitle' | 'clip'
  skillTags: string[]; // 推定された練習スキル
  difficulty: number; // 推定または指定された難易度 1-5
  cautionPoints: string[]; // 実案件から抽出した注意事項（ナレッジとして蓄積）
  revisionNote: string; // 修正指示文（初回納品後に届く想定のメッセージ）
  sampleDescription: string; // 完成見本の説明（何がどうなっていれば正解か）
  maskedCaseText: string; // 匿名化済みの実案件要約（real_cases.masked_content / RAG格納用）
  maskingReport: MaskingReport;
}

/** 素材動画（編集練習用の元動画）の台本生成リクエスト */
export interface GenerateSourceScriptInput {
  theme: string; // 例: 「カフェ店長へのインタビュー」
  targetKeepSeconds: number; // 完成版（カット後）の想定尺
  difficulty: number; // 1-5。高いほどカット箇所が微妙で見つけにくい
}

/** 台本のセグメント。cut = 編集で取り除くべき箇所（正解データの元） */
export interface SourceScriptSegment {
  text: string; // 話す内容。沈黙セグメントは空文字
  kind: "keep" | "cut";
  cutReason: "filler" | "mistake" | "silence" | "retake" | null; // kind=cut のときのみ
  silenceSeconds: number | null; // cutReason=silence のときの沈黙秒数
}

/** 素材動画の台本（音声合成→動画合成の入力。ふりがな記法は使わない） */
export interface GeneratedSourceScript {
  title: string;
  scenario: string; // 動画の設定説明（職員向け）
  keepDurationHint: number; // keepセグメントだけを残した場合の想定尺（秒）
  segments: SourceScriptSegment[];
}

/**
 * 実案件の配布用ガイド生成リクエスト。
 * 「別の案件を作る」のではなく、実案件そのものを就労者がこなせるように
 * 読みやすい依頼書＋手順書＋チェックリストを用意する（CrowdWorks案件の配布用）。
 */
export interface GenerateCaseGuideInput {
  caseText: string; // 実案件の依頼文（そのまま）
  traineeNote?: string; // 利用者への配慮メモ（任意）
}

/** 実案件の配布用ガイド生成結果 */
export interface GeneratedCaseGuide {
  title: string; // 案件タイトル（実案件から。【練習】は付けない）
  summary: string; // 1〜2文の平易な説明
  skillTags: string[]; // この案件で使うスキル（推定）
  difficulty: number; // 1〜5（推定）
  estimatedMinutes: number;
  // 実案件を就労者向けに読みやすく整形した依頼書（要求内容は変えない・ふりがなは付けない）
  readableRequestDoc: string;
  manualSteps: ManualStep[]; // この案件のやり方（手順書）
  selfCheckItems: string[]; // 納品前チェック項目
}

/**
 * 練習用素材台本の生成リクエスト（Stage2）。
 * 完成品ではなく「編集前のバラバラ素材一式」の元になる台本を作る。
 * priority(must/optional) 付きで、must合計≒完成尺・全体1.3〜1.5倍・冒頭15秒フックを狙う。
 * 建前は「常連YouTuber(styleGuide.client)からの次回動画の依頼」。
 */
export interface GeneratePracticeScriptInput {
  styleGuide: StyleGuideContent; // 現在有効なスタイルガイド（担当チャンネルの固定プロフィール）
  theme: string; // その回の動画テーマ（例:「在宅ワークの始め方」）
  difficulty: number; // 1-5。高いほど切る候補(optional)が微妙で判断が難しい
  targetKeepMinutes?: number; // 想定完成尺（分。既定10）
  traineeNote?: string; // 利用者への配慮メモ（任意）
}

/** 練習用素材台本の生成結果（正規化済み。schema.ts の型を再エクスポート） */
export type GeneratedPracticeScriptResult = GeneratedPracticeScript;

/** 提出物の採点リクエスト */
export interface GradeSubmissionInput {
  taskTitle: string;
  requestDoc: string;
  selfCheck: SelfCheckItem[];
  note: string | null;
  workMinutes: number | null;
  estimatedMinutes: number | null;
  isResubmission: boolean;
}

/** 採点結果 */
export interface GradeResult {
  score: number; // 0-100
  summary: string; // 短文・平易な日本語の総評
  goodPoints: string[];
  improvePoints: string[];
  criteria: FeedbackCriterion[];
}

export interface AiProvider {
  name: "gemini" | "mock";
  proposeStyleGuides(input: ProposeStyleGuidesInput): Promise<StyleGuideProposal>;
  generateTask(input: GenerateTaskInput): Promise<GeneratedTask>;
  generateSimilarCase(input: GenerateSimilarCaseInput): Promise<GeneratedSimilarCase>;
  generateCaseGuide(input: GenerateCaseGuideInput): Promise<GeneratedCaseGuide>;
  generateSourceScript(input: GenerateSourceScriptInput): Promise<GeneratedSourceScript>;
  generatePracticeScript(input: GeneratePracticeScriptInput): Promise<GeneratedPracticeScriptResult>;
  gradeSubmission(input: GradeSubmissionInput): Promise<GradeResult>;
}
