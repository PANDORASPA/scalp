import { NextResponse } from 'next/server'

import { buildHealthSummary } from '@/lib/settings/health'
import { getSystemStatus } from '@/lib/settings/status'

export const runtime = 'nodejs'

function getAppVersion() {
  return {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
  }
}

export async function GET() {
  const integrations = await getSystemStatus()

  return NextResponse.json(buildHealthSummary({
    integrations,
    checkedAt: new Date().toISOString(),
    version: getAppVersion(),
  }))
}
