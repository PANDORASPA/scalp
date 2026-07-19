-- Keep every image/summary attached to the same customer as its session.
-- NOT VALID lets existing historical rows remain readable while enforcing
-- ownership for all new writes until legacy mismatches are reviewed.

create unique index if not exists uq_scalp_sessions_id_customer
  on public.scalp_sessions (id, customer_id);

alter table public.scalp_images
  drop constraint if exists fk_scalp_images_session_customer;

alter table public.scalp_images
  add constraint fk_scalp_images_session_customer
  foreign key (session_id, customer_id)
  references public.scalp_sessions (id, customer_id)
  on delete cascade
  not valid;

alter table public.scalp_area_summaries
  drop constraint if exists fk_scalp_area_summaries_session_customer;

alter table public.scalp_area_summaries
  add constraint fk_scalp_area_summaries_session_customer
  foreign key (session_id, customer_id)
  references public.scalp_sessions (id, customer_id)
  on delete cascade
  not valid;

create index if not exists idx_scalp_images_customer_session
  on public.scalp_images (customer_id, session_id);

create index if not exists idx_scalp_area_summaries_customer_session
  on public.scalp_area_summaries (customer_id, session_id);
