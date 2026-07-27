-- =============================================================
-- 00007: 動画案件のジャンル（テンプレート）対応
-- 提案版 v1 — 適用前にレビューしてください
--
-- video_jobs にテンプレート種別を追加する。既存行（character_explainer相当で
-- 生成済みのジョブ）との後方互換のため、既定値を 'character_explainer' にする。
-- =============================================================

create type video_template_type as enum (
  'character_explainer',
  'vertical_short',
  'business_explainer',
  'product_promotion',
  'interview_edit',
  'vlog_edit'
);

alter table video_jobs
  add column template_type video_template_type not null default 'character_explainer';

comment on column video_jobs.template_type is
  '案件ジャンル。テンプレートごとの詳細設定は src/lib/video/templates/registry.ts で管理する';
