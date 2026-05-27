create table if not exists public.scalp_ai_shot_analyses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null references public.scalp_sessions(id) on delete cascade,
  image_id uuid not null unique references public.scalp_images(id) on delete cascade,
  capture_point_id uuid not null references public.scalp_capture_points(id),
  shot_index int not null check (shot_index between 1 and 3),
  hair_count_estimate numeric,
  confidence_score numeric,
  provider_name text not null default 'heuristic',
  analysis_method text not null,
  model_version text,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  notes text,
  fallback_used boolean not null default false,
  fallback_reason text,
  raw_output_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_scalp_ai_shot_session_point_shot unique (session_id, capture_point_id, shot_index)
);

create index if not exists idx_scalp_ai_shot_analyses_customer on public.scalp_ai_shot_analyses (customer_id);
create index if not exists idx_scalp_ai_shot_analyses_session on public.scalp_ai_shot_analyses (session_id);
create index if not exists idx_scalp_ai_shot_analyses_point on public.scalp_ai_shot_analyses (capture_point_id);
create index if not exists idx_scalp_ai_shot_analyses_image on public.scalp_ai_shot_analyses (image_id);

create trigger trg_scalp_ai_shot_analyses_updated_at
before update on public.scalp_ai_shot_analyses
for each row execute procedure public.set_updated_at();

create table if not exists public.scalp_ai_point_analyses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null references public.scalp_sessions(id) on delete cascade,
  capture_point_id uuid not null references public.scalp_capture_points(id),
  hair_count_avg_3shot numeric,
  hair_count_min numeric,
  hair_count_max numeric,
  completed boolean not null default false,
  provider_name text not null default 'heuristic',
  analysis_method text not null,
  confidence_score numeric,
  capture_consistency_score numeric,
  change_vs_previous numeric,
  fallback_used boolean not null default false,
  trend_direction text not null default 'inconclusive' check (trend_direction in ('improved', 'declined', 'stable', 'inconclusive')),
  trend_summary text not null default '',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_scalp_ai_point_session_point unique (session_id, capture_point_id)
);

create index if not exists idx_scalp_ai_point_analyses_customer on public.scalp_ai_point_analyses (customer_id);
create index if not exists idx_scalp_ai_point_analyses_session on public.scalp_ai_point_analyses (session_id);
create index if not exists idx_scalp_ai_point_analyses_point on public.scalp_ai_point_analyses (capture_point_id);

create trigger trg_scalp_ai_point_analyses_updated_at
before update on public.scalp_ai_point_analyses
for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('scalp-images', 'scalp-images', true)
on conflict (id) do nothing;
