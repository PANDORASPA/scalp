-- Keep legacy capture images private while retaining their existing object paths.
-- Tracking images use Google Drive by default; this backfill covers Supabase-backed
-- legacy images created before storage metadata was added.
update public.scalp_images as images
set
  storage_provider = 'supabase',
  storage_object_key = coalesce(
    images.storage_object_key,
    images.customer_id::text || '/' || images.session_id::text || '/' || points.code || '/' || images.shot_index::text || '.jpg'
  )
from public.scalp_capture_points as points
where images.capture_point_id = points.id
  and coalesce(images.storage_provider, 'legacy_local') = 'legacy_local';

update storage.buckets
set public = false
where id = 'scalp-images';

-- All application data is accessed through the server-side service role. Do not
-- expose customer records, annotations, metrics, or integration secrets through
-- Supabase's public Data API roles.
alter table public.customers enable row level security;
alter table public.scalp_sessions enable row level security;
alter table public.scalp_capture_points enable row level security;
alter table public.scalp_images enable row level security;
alter table public.scalp_image_metrics enable row level security;
alter table public.scalp_point_summaries enable row level security;
alter table public.scalp_comparisons enable row level security;
alter table public.scalp_ai_shot_analyses enable row level security;
alter table public.scalp_ai_point_analyses enable row level security;
alter table public.scalp_area_summaries enable row level security;
alter table public.app_settings enable row level security;

revoke all on table
  public.customers,
  public.scalp_sessions,
  public.scalp_capture_points,
  public.scalp_images,
  public.scalp_image_metrics,
  public.scalp_point_summaries,
  public.scalp_comparisons,
  public.scalp_ai_shot_analyses,
  public.scalp_ai_point_analyses,
  public.scalp_area_summaries,
  public.app_settings
from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on table
  public.customers,
  public.scalp_sessions,
  public.scalp_capture_points,
  public.scalp_images,
  public.scalp_image_metrics,
  public.scalp_point_summaries,
  public.scalp_comparisons,
  public.scalp_ai_shot_analyses,
  public.scalp_ai_point_analyses,
  public.scalp_area_summaries,
  public.app_settings
to service_role;
