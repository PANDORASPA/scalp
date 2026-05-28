import { NextResponse } from 'next/server'

import { getSystemStatus } from '@/lib/settings/status'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    integrations: getSystemStatus(),
    updated_at: new Date().toISOString(),
  })
}
