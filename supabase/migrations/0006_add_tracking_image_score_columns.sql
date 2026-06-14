alter table public.scalp_images
  add column if not exists redness_score numeric,
  add column if not exists density_score numeric;
