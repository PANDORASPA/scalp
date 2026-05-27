create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_name on public.customers (name);
create index if not exists idx_customers_phone on public.customers (phone);

create trigger trg_customers_updated_at
before update on public.customers
for each row execute procedure public.set_updated_at();

create table if not exists public.scalp_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  check_date timestamptz not null,
  staff_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scalp_sessions_customer_id on public.scalp_sessions (customer_id);
create index if not exists idx_scalp_sessions_check_date on public.scalp_sessions (check_date desc);

create trigger trg_scalp_sessions_updated_at
before update on public.scalp_sessions
for each row execute procedure public.set_updated_at();

create table if not exists public.scalp_capture_points (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scalp_capture_points_sort on public.scalp_capture_points (sort_order asc);

create trigger trg_scalp_capture_points_updated_at
before update on public.scalp_capture_points
for each row execute procedure public.set_updated_at();

create table if not exists public.scalp_images (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null references public.scalp_sessions(id) on delete cascade,
  capture_point_id uuid not null references public.scalp_capture_points(id),
  shot_index int not null check (shot_index between 1 and 3),
  image_type text not null default 'micro',
  magnification text,
  lighting_mode text,
  hair_state text,
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_scalp_images_session_point_shot unique (session_id, capture_point_id, shot_index)
);

create index if not exists idx_scalp_images_session on public.scalp_images (session_id);
create index if not exists idx_scalp_images_customer on public.scalp_images (customer_id);
create index if not exists idx_scalp_images_point on public.scalp_images (capture_point_id);

create trigger trg_scalp_images_updated_at
before update on public.scalp_images
for each row execute procedure public.set_updated_at();

create table if not exists public.scalp_image_metrics (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.scalp_images(id) on delete cascade,
  oil_score numeric,
  redness_score numeric,
  density_score numeric,
  blockage_score numeric,
  dandruff_score numeric,
  sensitivity_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_scalp_image_metrics_image unique (image_id)
);

create index if not exists idx_scalp_image_metrics_image_id on public.scalp_image_metrics (image_id);

create trigger trg_scalp_image_metrics_updated_at
before update on public.scalp_image_metrics
for each row execute procedure public.set_updated_at();

create table if not exists public.scalp_point_summaries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null references public.scalp_sessions(id) on delete cascade,
  capture_point_id uuid not null references public.scalp_capture_points(id),
  oil_avg numeric,
  redness_avg numeric,
  density_avg numeric,
  blockage_avg numeric,
  dandruff_avg numeric,
  sensitivity_avg numeric,
  completed boolean not null default false,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_scalp_point_summaries_session_point unique (session_id, capture_point_id)
);

create index if not exists idx_scalp_point_summaries_session on public.scalp_point_summaries (session_id);
create index if not exists idx_scalp_point_summaries_customer on public.scalp_point_summaries (customer_id);
create index if not exists idx_scalp_point_summaries_point on public.scalp_point_summaries (capture_point_id);

create trigger trg_scalp_point_summaries_updated_at
before update on public.scalp_point_summaries
for each row execute procedure public.set_updated_at();

create table if not exists public.scalp_comparisons (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  capture_point_id uuid not null references public.scalp_capture_points(id),
  current_session_id uuid not null references public.scalp_sessions(id) on delete cascade,
  previous_session_id uuid not null references public.scalp_sessions(id) on delete cascade,
  oil_change numeric,
  redness_change numeric,
  density_change numeric,
  blockage_change numeric,
  dandruff_change numeric,
  sensitivity_change numeric,
  comparison_summary text not null,
  created_at timestamptz not null default now(),
  constraint uq_scalp_comparisons_pair unique (current_session_id, previous_session_id, capture_point_id)
);

create index if not exists idx_scalp_comparisons_customer on public.scalp_comparisons (customer_id);
create index if not exists idx_scalp_comparisons_current on public.scalp_comparisons (current_session_id);
create index if not exists idx_scalp_comparisons_previous on public.scalp_comparisons (previous_session_id);

