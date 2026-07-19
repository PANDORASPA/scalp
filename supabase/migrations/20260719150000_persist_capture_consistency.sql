alter table public.scalp_area_summaries
  add column if not exists capture_consistency_score numeric;

alter table public.scalp_area_summaries
  drop constraint if exists scalp_area_summaries_capture_consistency_score_check;

alter table public.scalp_area_summaries
  add constraint scalp_area_summaries_capture_consistency_score_check
  check (
    capture_consistency_score is null
    or (capture_consistency_score >= 0 and capture_consistency_score <= 100)
  ) not valid;

alter table public.scalp_area_summaries
  validate constraint scalp_area_summaries_capture_consistency_score_check;
