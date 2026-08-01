-- 00013: Feed real case context into AI video jobs.
--
-- The generated sample video should be based on a realistic editing brief, not
-- only a loose theme. `case_context` stores an anonymized or staff-entered
-- brief snapshot used by the worker when generating the video script.

alter table public.video_jobs
  add column if not exists source_case_id uuid references public.case_knowledge (id) on delete set null,
  add column if not exists case_context text;

comment on column public.video_jobs.source_case_id is
  'Optional case_knowledge row used as the real-case reference for this generated video job.';
comment on column public.video_jobs.case_context is
  'Real editing brief/context injected into script generation. Prefer anonymized case_knowledge text.';
