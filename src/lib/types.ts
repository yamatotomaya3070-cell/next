// データベース型定義（supabase/migrations/00001_initial_schema.sql と対応）

import type { VideoTemplateType } from "./video/templates";
import type { CheckResult, ProbeResult } from "./video/inspection/types";

export type UserRole = "trainee" | "staff" | "admin";
export type TaskType = "practice" | "real";
export type TaskStatus = "draft" | "published" | "archived";
export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "feedback"
  | "completed";
export type MaterialKind =
  | "request_doc"
  | "manual"
  | "script"
  | "sample"
  | "revision_note"
  | "screenshot_guide"
  | "source_assets";
export type FeedbackSource = "ai" | "staff";
export type FeedbackStatus = "pending_review" | "approved" | "rejected";
export type ProgressEvent =
  | "start"
  | "pause"
  | "resume"
  | "progress"
  | "submit"
  | "consult"
  | "break";
export type AptitudeKey =
  | "pc_endurance"
  | "detail_focus"
  | "instruction_follow"
  | "repetitive_work"
  | "asking_for_help"
  | "revision_response"
  | "deadline_awareness"
  | "motivation";

export const APTITUDE_LABELS: Record<AptitudeKey, string> = {
  pc_endurance: "パソコン作業の継続",
  detail_focus: "細かい作業への集中力",
  instruction_follow: "指示書に沿った作業",
  repetitive_work: "繰り返し作業",
  asking_for_help: "困った時の相談",
  revision_response: "修正指示への対応",
  deadline_awareness: "納期意識",
  motivation: "興味・達成感",
};

export const SKILL_TAG_LABELS: Record<string, string> = {
  cut: "カット編集",
  telop: "テロップ・字幕",
  bgm: "BGM・効果音",
  volume: "音量調整",
  image: "画像・ロゴ挿入",
  color: "色味・明るさ",
  duration: "指定尺への調整",
  export: "書き出し",
  revision: "修正対応",
  brief: "依頼内容の確認",
};

export const ASSIGNMENT_STATUS_LABELS: Record<
  AssignmentStatus,
  { label: string; color: string }
> = {
  not_started: { label: "未着手", color: "bg-page text-ink-soft" },
  in_progress: { label: "作業中", color: "bg-primary-soft text-primary-dark" },
  submitted: { label: "レビュー待ち", color: "bg-warning-soft text-amber-700" },
  feedback: {
    label: "レビュー結果あり",
    color: "bg-accent-purple-soft text-accent-purple",
  },
  completed: { label: "完了", color: "bg-success-soft text-success" },
};

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
  display_name_kana: string | null;
  furigana_enabled: boolean;
  step_mode_enabled: boolean;
  large_text_enabled: boolean;
  read_aloud_enabled: boolean;
  break_interval_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  summary: string | null;
  difficulty: number;
  skill_tags: string[];
  estimated_minutes: number | null;
  due_in_days: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualStep {
  text: string;
  tip?: string | null;
  image_url?: string | null;
}

/**
 * 作業手順(manualSteps)の学習ルール（manual_guidelines テーブル）。
 * 「直した内容(rule)」＋「なぜ(reason)」を蓄積し、以後のAI手順生成に自動注入する。
 */
export interface ManualGuideline {
  id: string;
  title: string; // 短い要約（見出し）
  rule: string; // 守るべきルール（AIへの指示文）
  reason: string; // なぜ直すのか（根拠）
  example_before: string | null; // 修正前のNG例（任意）
  example_after: string | null; // 修正後のあるべき例（任意）
  skill_tags: string[]; // 対象スキル（空=全案件）
  is_active: boolean;
  source_task_id: string | null; // どの案件の修正から学んだか（任意）
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskMaterial {
  id: string;
  task_id: string;
  kind: MaterialKind;
  title: string;
  content: string | null;
  steps: ManualStep[] | null;
  media_url: string | null;
  sort_order: number;
  generated_by: FeedbackSource;
  is_approved: boolean;
  /** kind='sample' のみ使用: false の場合、提出前は職員のみ閲覧可（就労者には提出後に公開） */
  visible_before_submission: boolean;
  created_at: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  status: AssignmentStatus;
  due_at: string | null;
  assigned_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SelfCheckItem {
  item: string;
  checked: boolean;
}

export interface Submission {
  id: string;
  assignment_id: string;
  version: number;
  file_path: string | null;
  file_name: string | null;
  note: string | null;
  self_check: SelfCheckItem[] | null;
  work_minutes: number | null;
  submitted_at: string;
}

export interface FeedbackCriterion {
  key: string;
  label: string;
  score: number; // 0-5
  comment: string;
}

export interface Feedback {
  id: string;
  submission_id: string;
  source: FeedbackSource;
  status: FeedbackStatus;
  score: number | null;
  summary: string | null;
  good_points: string[] | null;
  improve_points: string[] | null;
  criteria: FeedbackCriterion[] | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ProgressLog {
  id: string;
  assignment_id: string;
  user_id: string;
  event: ProgressEvent;
  progress_percent: number | null;
  minutes_delta: number | null;
  is_delayed: boolean;
  note: string | null;
  created_at: string;
}

export interface UserAptitude {
  id: string;
  user_id: string;
  key: AptitudeKey;
  rating: number;
  note: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

/** 本番移行の承認記録（supabase/migrations/00010_production_transfer_approvals.sql と対応） */
export interface ProductionTransferApproval {
  id: string;
  user_id: string;
  decision: "approved" | "revoked";
  note: string | null;
  approved_by: string | null;
  created_at: string;
}

/** 実案件ナレッジ（supabase/migrations/00005_case_knowledge.sql と対応） */
export interface CaseKnowledge {
  id: string;
  title: string;
  genre: string | null;
  skill_tags: string[];
  difficulty: number | null;
  caution_points: string[];
  masked_case_text: string;
  masking_report: { removedItems: string[]; riskNotes: string[] } | null;
  source: string;
  converted_task_id: string | null;
  created_by: string | null;
  created_at: string;
}

/** AI動画案件の生成ジョブ（supabase/migrations/00006_video_jobs.sql と対応） */
export type VideoJobStatus =
  | "pending"
  | "generating_script"
  | "generating_voice"
  | "generating_assets"
  | "generating_subtitles"
  | "rendering_preview"
  | "packaging_assets"
  | "registering_task"
  | "completed"
  | "failed";

export const VIDEO_JOB_STATUS_LABELS: Record<VideoJobStatus, string> = {
  pending: "待機中",
  generating_script: "台本を作成中",
  generating_voice: "音声を作成中",
  generating_assets: "素材を準備中",
  generating_subtitles: "字幕を作成中",
  rendering_preview: "完成見本を作成中",
  packaging_assets: "支給素材をまとめ中",
  registering_task: "案件を登録中",
  completed: "完了",
  failed: "失敗",
};

export interface VideoJobArtifacts {
  sample_video?: string;
  assets_zip?: string;
  raw_take_video?: string;
}

export interface VideoJob {
  id: string;
  theme: string;
  difficulty: number;
  target_duration_sec: number;
  template_type: VideoTemplateType;
  source_case_id: string | null;
  case_context: string | null;
  status: VideoJobStatus;
  progress: number;
  script: unknown;
  timeline: unknown;
  answer_data: unknown;
  artifacts: VideoJobArtifacts | null;
  error: string | null;
  error_stage: VideoJobStatus | null;
  retry_count: number;
  provider: string | null;
  locked_by: string | null;
  locked_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  task_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoJobEvent {
  id: string;
  job_id: string;
  stage: VideoJobStatus;
  event: "started" | "completed" | "failed" | "skipped";
  detail: string | null;
  duration_ms: number | null;
  created_at: string;
}

// --- SCENE動画案件（高品質金融解説・完全ハイブリッド）のジョブ ---
export type SceneJobStatus =
  | "pending"
  | "generating_scene"
  | "rendering_video"
  | "building_materials"
  | "building_manual"
  | "registering_task"
  | "completed"
  | "failed";

export const SCENE_JOB_STATUS_LABELS: Record<SceneJobStatus, string> = {
  pending: "待機中",
  generating_scene: "設計図を作成中",
  rendering_video: "完成見本を作成中",
  building_materials: "素材を書き出し中",
  building_manual: "手順書を作成中",
  registering_task: "案件を登録中",
  completed: "完了",
  failed: "失敗",
};

export interface SceneJobArtifacts {
  sample_video?: string;
  assets_zip?: string;
}

// 生成ナレッジ（動画・仕様書の不備／発音の指摘）。次回以降の生成に自動注入する。
export interface SceneGenerationNote {
  id: string;
  note: string;
  category: string | null;
  term: string | null;
  reading: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneJob {
  id: string;
  theme: string;
  audience: string;
  target_minutes: number;
  difficulty: number;
  status: SceneJobStatus;
  progress: number;
  project: unknown;
  artifacts: SceneJobArtifacts | null;
  error: string | null;
  error_stage: SceneJobStatus | null;
  retry_count: number;
  locked_by: string | null;
  locked_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  task_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QaLog {
  id: string;
  user_id: string;
  assignment_id: string | null;
  question: string;
  answer: string | null;
  answered_by: FeedbackSource | null;
  needs_staff: boolean;
  answered_at: string | null;
  created_at: string;
}

/** 提出動画の機械検品ジョブ（supabase/migrations/00008_submission_inspections.sql と対応） */
export type SubmissionInspectionStatus =
  | "pending"
  | "probing"
  | "comparing"
  | "completed"
  | "skipped"
  | "failed";

export const SUBMISSION_INSPECTION_STATUS_LABELS: Record<SubmissionInspectionStatus, string> = {
  pending: "検品待ち",
  probing: "動画を解析中",
  comparing: "正解データと照合中",
  completed: "検品完了",
  skipped: "検品対象外",
  failed: "検品失敗",
};

export type { CheckStatus, CheckItem, ProbeResult, CheckResult } from "./video/inspection/types";

export interface SubmissionInspection {
  id: string;
  submission_id: string;
  status: SubmissionInspectionStatus;
  progress: number;
  probe_result: ProbeResult | null;
  check_result: CheckResult | null;
  error: string | null;
  error_stage: SubmissionInspectionStatus | null;
  retry_count: number;
  locked_by: string | null;
  locked_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type { StyleGuideContent } from "./style-guide/schema";

/**
 * シリーズ共通スタイルガイド（担当YouTuberのチャンネル固定プロフィール）。
 * supabase/migrations/00014_style_guides.sql と対応。content は StyleGuideContent。
 * is_active な1件を全生成工程が参照する。編集＝新バージョン追記→有効化で切替。
 */
export interface StyleGuideRecord {
  id: string;
  name: string;
  version: number;
  is_active: boolean;
  content: import("./style-guide/schema").StyleGuideContent;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
