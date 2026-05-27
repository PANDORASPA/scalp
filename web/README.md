# Scalp Check Tool

## Supabase Cutover

The app supports two runtime modes:

- Local mock mode: used automatically when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.
- Supabase mode: enabled when all required server-only Supabase env vars are present.

### Required env

Copy values from [.env.example](/D:/hairloss/web/.env.example):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SCALP_AI_PROVIDER`

For the current cutover, keep:

- `SCALP_AI_PROVIDER=heuristic`

### Migration order

Run these migrations in order:

1. `0001_init_scalp_tool.sql`
2. `0002_seed_scalp_capture_points.sql`
3. `0003_add_ai_analysis_and_storage.sql`
4. `0004_scalp_tracking_analysis.sql`

`0003` creates the AI analysis tables and the `scalp-images` storage bucket.
`0004` adds the scalp-analysis tracking columns, tracking workflow type, and `scalp_area_summaries`.

### Verification flow

1. Fill the server-only Supabase env vars.
2. Start the app.
3. Run `npm run smoke:supabase`.

The smoke script checks:

- required tables exist
- storage bucket exists
- capture points are seeded
- optional API flow if `APP_BASE_URL` is set:
  - login
  - seed or create customer/session
  - upload one shot
  - verify session state
  - delete the shot

### Common failures

- `supabase_env_missing`
  - Supabase env vars are not set, so the app stays in local mock mode.
- `supabase_schema_missing`
  - The migrations were not fully applied.
- `supabase_storage_error`
  - The storage bucket is missing or inaccessible.

## Scalp Analysis Tracking

The new `/scalp-analysis` page uses:

- `customers` and `scalp_sessions` from the existing app
- Google Drive for source image storage
- Supabase Postgres for metadata, AI JSON, confirmed annotations, image stats, and area summaries

### Required env

- `SCALP_ANALYSIS_STORAGE_PROVIDER=google-drive`
- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`
- `SCALP_ANALYSIS_AI_PROVIDER=mock`
- `OPENAI_API_KEY` and `OPENAI_VISION_MODEL` only when switching to OpenAI Vision

### Google Drive setup

1. Create a Google Cloud project and enable the Google Drive API.
2. Create a service account.
3. Generate a JSON key for the service account.
4. Create or choose a Drive folder for scalp images.
5. Share that folder with the service account email as an editor.
6. Copy the JSON fields into env:
   - `client_email` -> `GOOGLE_DRIVE_CLIENT_EMAIL`
   - `private_key` -> `GOOGLE_DRIVE_PRIVATE_KEY` (keep `\n` escaped in `.env`)
7. Copy the folder id from the Drive URL into `GOOGLE_DRIVE_FOLDER_ID`.

### Tracking flow

1. Open `/scalp-analysis`.
2. Select a customer.
3. Create a tracking session.
4. Upload 3 images for each of the 6 fixed areas.
5. Review AI markers, edit them, then click `Confirm annotations`.
6. After 3 confirmed images in one area, the area average and previous/baseline comparison appear automatically.

### Manual checklist

1. Create a new tracking session and verify it appears only in `/scalp-analysis` session list.
2. Upload one image and confirm `drive_file_id`, `image_url`, and `analysis_status` are saved in `scalp_images`.
3. Confirm annotations for one image and verify the image stats columns are updated.
4. Confirm 3 images in the same area and verify one `scalp_area_summaries` row is created.
5. Create a second tracking session for the same customer, complete the same area, and verify `compared_to_previous_json` updates.
6. Verify the earliest completed tracking session becomes the baseline for `compared_to_baseline_json`.
7. Delete one image and confirm the area summary is removed until 3 confirmed images are available again.

### OpenAI Vision setup

The app now supports `SCALP_ANALYSIS_AI_PROVIDER=openai-5.5`.

Required env:

- `SCALP_ANALYSIS_AI_PROVIDER=openai-5.5`
- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL=gpt-5.5`
- `OPENAI_VISION_TIMEOUT_MS=30000`

The provider uses the OpenAI Responses API with image input and structured JSON output. If `gpt-5.5` is not enabled on the account yet, change only `OPENAI_VISION_MODEL` to an available vision-capable model and keep the rest of the app unchanged.
