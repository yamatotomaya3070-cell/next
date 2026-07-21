// データベース型定義（supabase/migrations/00001_initial_schema.sql と対応）

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
  | "screenshot_guide";
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
