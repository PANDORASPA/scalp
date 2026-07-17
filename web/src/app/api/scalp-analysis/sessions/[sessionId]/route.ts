import { NextResponse } from 'next/server'

import { jsonNoStore } from '@/lib/api/response'
import { requireAuthRole } from '@/lib/auth/session'
import { getScalpAnalysisSessionState, toScalpAnalysisError } from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

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
