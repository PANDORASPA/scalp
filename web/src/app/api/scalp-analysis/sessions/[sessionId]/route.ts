import { NextResponse } from 'next/server'

import { readJsonBody } from '@/lib/api/json'
import { jsonNoStore } from '@/lib/api/response'
import { requireAuthRole } from '@/lib/auth/session'
import {
  getScalpAnalysisSessionState,
  removeScalpSession,
  toScalpAnalysisError,
  updateScalpSession,
} from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime())
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { sessionId } = await params
  const parsed = await readJsonBody<{ sessionDate?: string; notes?: string | null }>(req)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const sessionDate = parsed.body.sessionDate?.toString() ?? ''
  if (!sessionDate || !isValidDate(sessionDate)) {
    return NextResponse.json({ error: 'invalid_session_date' }, { status: 400 })
  }

  try {
    return NextResponse.json(
      await updateScalpSession(sessionId, {
        sessionDate,
        notes: parsed.body.notes?.toString().trim() || null,
      }),
    )
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthRole(['admin'])
  if (!auth.ok) return auth.response

  const { sessionId } = await params
  try {
    return NextResponse.json(await removeScalpSession(sessionId))
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { sessionId } = await params
  try {
    const state = await getScalpAnalysisSessionState(sessionId)
    if (!state) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return jsonNoStore(state)
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
