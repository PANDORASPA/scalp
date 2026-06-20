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
- `AUTH_USERS_JSON`
- `SCALP_AI_PROVIDER`

For the current cutover, keep:

- `SCALP_AI_PROVIDER=heuristic`

For local testing only, the app falls back to demo login users when `AUTH_USERS_JSON` is empty. Official launch requires `AUTH_USERS_JSON` with non-default passwords:

```json
[{"username":"owner","password":"change-this-long-password","name":"Owner","role":"admin"},{"username":"frontdesk","password":"change-this-too","name":"Front Desk","role":"staff"}]
```

Generate a safe production value instead of hand-writing passwords:

```powershell
npm.cmd run setup:auth-users
```

Optional custom usernames:

```powershell
npm.cmd run setup:auth-users -- --owner-username=manager --owner-name="Shop Manager" --staff-username=frontdesk --staff-name="Front Desk"
```

Copy the printed JSON into Vercel as `AUTH_USERS_JSON` for Production, then redeploy and run `npm run smoke:health`.

### Migration order

Run these migrations in order:

1. `0001_init_scalp_tool.sql`
2. `0002_seed_scalp_capture_points.sql`
3. `0003_add_ai_analysis_and_storage.sql`
4. `0004_scalp_tracking_analysis.sql`
5. `0005_app_integration_settings.sql`
6. `0006_add_tracking_image_score_columns.sql`

`0003` creates the AI analysis tables and the `scalp-images` storage bucket.
`0004` adds the scalp-analysis tracking columns, tracking workflow type, and `scalp_area_summaries`.
`0005` stores app-level integration settings, including Google Drive and AI provider settings.
`0006` adds image-level score columns used by the scalp-analysis tracking report.

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

## Release Gate

Before considering a deployment ready, run:

```powershell
npm.cmd run release:gate
```

To validate the deployed Vercel app as well:

```powershell
$env:APP_BASE_URL='https://scalp-lake.vercel.app'
$env:SMOKE_CLEANUP='true'
npm.cmd run release:gate
```

The gate runs:

- unit/domain tests
- production build
- optional live `/api/health` readiness check when `APP_BASE_URL` is set
- optional live settings checks when `APP_BASE_URL` is set
- optional live customer/session operations smoke when `APP_BASE_URL` is set
- optional live `/scalp-analysis` smoke flow when `APP_BASE_URL` is set

For final official launch, require real Google Drive and OpenAI integrations:

```powershell
$env:APP_BASE_URL='https://scalp-lake.vercel.app'
$env:REQUIRE_OFFICIAL_INTEGRATIONS='true'
$env:SMOKE_CLEANUP='true'
npm.cmd run release:gate
```

If staff auth is still using demo users, Google Drive is still in Demo mode, or AI is still in Mock mode, this official gate intentionally fails.

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

You may also configure Google Drive and AI credentials from `/settings`. Secrets saved there are stored server-side in Supabase `app_settings`; private keys and API keys are not displayed back to the browser after saving.

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

### Live smoke test

Check live deployment health and official-readiness blockers:

```powershell
$env:APP_BASE_URL='https://scalp-lake.vercel.app'
npm.cmd run smoke:health
```

`/api/health` reports whether the app is operational, whether it is officially ready, the Vercel commit metadata when available, and any remaining blockers such as Demo Google Drive storage or Mock AI.

Run the fast daily operations smoke flow against the deployed app:

```powershell
$env:APP_BASE_URL='https://scalp-lake.vercel.app'
npm.cmd run smoke:operations
```

This verifies login, customer create/read/update, session create/read/update, customer overview, and cleanup.

Run the complete longitudinal tracking smoke flow against the deployed app:

```powershell
$env:APP_BASE_URL='https://scalp-lake.vercel.app'
$env:SMOKE_CLEANUP='true'
npm.cmd run smoke:scalp-analysis
```

This creates one smoke customer, two tracking sessions, and 36 tiny test images. With `SMOKE_CLEANUP=true`, the script deletes the smoke customer after verification so the production customer list is not polluted.

### Smoke customer cleanup

If older smoke tests left `Scalp Smoke ...` customers in production, preview them first:

```powershell
$env:APP_BASE_URL='https://scalp-lake.vercel.app'
npm.cmd run cleanup:smoke-customers
```

The cleanup script is dry-run by default. It only targets customers whose name starts with `Scalp Smoke ` and whose notes equal `Created by smoke-scalp-analysis.mjs`.

To delete the matched smoke customers:

```powershell
$env:APP_BASE_URL='https://scalp-lake.vercel.app'
$env:CONFIRM_DELETE_SMOKE_DATA='true'
npm.cmd run cleanup:smoke-customers
```

### OpenAI Vision setup

The app now supports `SCALP_ANALYSIS_AI_PROVIDER=openai-5.5`.

Required env:

- `SCALP_ANALYSIS_AI_PROVIDER=openai-5.5`
- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL=gpt-5.5`
- `OPENAI_VISION_TIMEOUT_MS=30000`

The provider uses the OpenAI Responses API with image input and structured JSON output. If `gpt-5.5` is not enabled on the account yet, change only `OPENAI_VISION_MODEL` to an available vision-capable model and keep the rest of the app unchanged.
