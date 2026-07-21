import type { FeedbackCriterion, ManualStep, SelfCheckItem } from "@/lib/types";

/** 練習教材の生成リクエスト */
export interface GenerateTaskInput {
  theme: string; // 例: 「料理動画にテロップを入れる」
  difficulty: number; // 1-5
  skillTags: string[]; // 例: ['telop', 'script']
  traineeNote?: string; // 利用者特性に合わせた調整メモ（任意）
  knowledgeContext?: string; // 蓄積済み実案件ナレッジの要約（依頼傾向・注意事項）
}

/** 練習教材の生成結果 */
export interface GeneratedTask {
  title: string;
  summary: string;
  estimatedMinutes: number;
  dueInDays: number;
  requestDoc: string; // 模擬依頼書（Markdown、ふりがな 漢字《かんじ》 記法）
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
  generateTask(input: GenerateTaskInput): Promise<GeneratedTask>;
  generateSimilarCase(input: GenerateSimilarCaseInput): Promise<GeneratedSimilarCase>;
  generateSourceScript(input: GenerateSourceScriptInput): Promise<GeneratedSourceScript>;
  gradeSubmission(input: GradeSubmissionInput): Promise<GradeResult>;
}
