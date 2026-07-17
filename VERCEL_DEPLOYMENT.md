# Vercel Deployment

This repository keeps the Next.js application in the `web/` directory.

## Required Project Setting

In Vercel Project Settings:

- Framework Preset: `Next.js`
- Root Directory: `web`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave blank

If Root Directory is left as the repository root, Vercel will not deploy the Next.js app correctly.

## Required Environment Variables

Production and Preview should include:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=scalp-images

SCALP_ANALYSIS_STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_CLIENT_EMAIL=
GOOGLE_DRIVE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_DRIVE_PUBLIC_ACCESS=false

SCALP_ANALYSIS_AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.5
OPENAI_VISION_TIMEOUT_MS=30000

SCALP_AI_PROVIDER=heuristic
SCALP_AI_TIMEOUT_MS=2500
SCALP_AI_ALLOW_FALLBACK=true
```

Keep `SCALP_ANALYSIS_AI_PROVIDER=mock` until the OpenAI key is ready.
