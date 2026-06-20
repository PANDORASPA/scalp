import { NextResponse } from 'next/server'

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
  const operationalReady = integrations.every((item) => item.ready)
  const officialReady = integrations.every((item) => item.officialReady)

  return NextResponse.json({
    ok: operationalReady,
    officialReady,
    status: officialReady
      ? 'official_ready'
      : operationalReady
        ? 'operational_with_demo_integrations'
        : 'not_ready',
    checkedAt: new Date().toISOString(),
    version: getAppVersion(),
    integrations,
    blockers: integrations
      .filter((item) => !item.officialReady)
      .map((item) => ({
        key: item.key,
        label: item.label,
        mode: item.mode,
        details: item.details,
        nextAction: item.nextAction ?? null,
      })),
  })
}
