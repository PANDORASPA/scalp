insert into public.scalp_capture_points (code, display_name, sort_order)
values
  ('front', 'Front', 1),
  ('left', 'Left', 2),
  ('right', 'Right', 3),
  ('crown', 'Crown', 4),
  ('back', 'Back', 5)
on conflict (code) do update set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order;

