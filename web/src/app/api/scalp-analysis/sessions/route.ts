import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { createScalpSession, toScalpAnalysisError } from '@/lib/scalp-analysis/service'
import { listTrackingSessions } from '@/lib/scalp-analysis/repository'

export const runtime = 'nodejs'

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime())
}

export async function GET(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const customerId = url.searchParams.get('customerId') ?? ''
  if (!customerId) {
    return NextResponse.json({ error: 'customer_id_required' }, { status: 400 })
  }

  try {
    return NextResponse.json(await listTrackingSessions(customerId))
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as {
    customerId?: string
    sessionDate?: string
    notes?: string | null
  }

  const customerId = body.customerId?.toString() ?? ''
  const sessionDate = body.sessionDate?.toString() ?? new Date().toISOString()

  if (!customerId) {
    return NextResponse.json({ error: 'customer_id_required' }, { status: 400 })
  }
  if (!isValidDate(sessionDate)) {
    return NextResponse.json({ error: 'invalid_session_date' }, { status: 400 })
  }

  try {
    const session = await createScalpSession(customerId, {
      sessionDate,
      notes: body.notes?.toString().trim() || null,
    })
    return NextResponse.json(session)
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
