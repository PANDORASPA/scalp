import { NextResponse } from 'next/server'

import { getScalpAnalysisSessionState, toScalpAnalysisError } from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params
  try {
    const state = await getScalpAnalysisSessionState(sessionId)
    if (!state) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(state)
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
