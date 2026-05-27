alter table public.scalp_sessions
  add column if not exists workflow_type text not null default 'legacy_capture';

alter table public.scalp_sessions
  drop constraint if exists scalp_sessions_workflow_type_check;

alter table public.scalp_sessions
  add constraint scalp_sessions_workflow_type_check
  check (workflow_type in ('legacy_capture', 'scalp_analysis_tracking'));

create index if not exists idx_scalp_sessions_workflow_type
  on public.scalp_sessions (workflow_type);

alter table public.scalp_images
  add column if not exists storage_provider text not null default 'legacy_local',
  add column if not exists storage_object_key text,
  add column if not exists drive_file_id text,
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists ai_result_json jsonb,
  add column if not exists confirmed_annotations_json jsonb,
  add column if not exists coarse_hair_count integer,
  add column if not exists baby_hair_count integer,
  add column if not exists empty_follicle_count integer,
  add column if not exists blockage_count integer,
  add column if not exists scalp_empty_ratio numeric,
  add column if not exists oiliness_score numeric,
  add column if not exists analysis_notes text;

alter table public.scalp_images
  drop constraint if exists scalp_images_analysis_status_check;

alter table public.scalp_images
  add constraint scalp_images_analysis_status_check
  check (analysis_status in ('pending', 'uploaded', 'ai_ready', 'ai_failed', 'confirmed'));

create index if not exists idx_scalp_images_drive_file_id
  on public.scalp_images (drive_file_id);

create index if not exists idx_scalp_images_analysis_status
  on public.scalp_images (analysis_status);

create table if not exists public.scalp_area_summaries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null references public.scalp_sessions(id) on delete cascade,
  capture_point_id uuid not null references public.scalp_capture_points(id),
  average_coarse_hair_count numeric,
  average_baby_hair_count numeric,
  average_empty_follicle_count numeric,
  average_blockage_count numeric,
  average_scalp_empty_ratio numeric,
  average_redness_score numeric,
  average_oiliness_score numeric,
  average_density_score numeric,
  compared_to_previous_json jsonb,
  compared_to_baseline_json jsonb,
  report_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_scalp_area_summaries_session_point unique (session_id, capture_point_id)
);

create index if not exists idx_scalp_area_summaries_customer
  on public.scalp_area_summaries (customer_id);

create index if not exists idx_scalp_area_summaries_session
  on public.scalp_area_summaries (session_id);

create index if not exists idx_scalp_area_summaries_point
  on public.scalp_area_summaries (capture_point_id);

drop trigger if exists trg_scalp_area_summaries_updated_at on public.scalp_area_summaries;

create trigger trg_scalp_area_summaries_updated_at
before update on public.scalp_area_summaries
for each row execute procedure public.set_updated_at();

insert into public.scalp_capture_points (code, display_name, sort_order)
values
  ('m_left', 'M Left', 101),
  ('m_right', 'M Right', 102),
  ('front_center', 'Front Center', 103),
  ('crown', 'Crown', 104),
  ('vertex', 'Vertex', 105),
  ('occipital_control', 'Occipital Control', 106)
on conflict (code) do update
set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  updated_at = now();
