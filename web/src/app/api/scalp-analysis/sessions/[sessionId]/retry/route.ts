import { NextResponse } from 'next/server'

import { jsonNoStore } from '@/lib/api/response'
import { requireAuthRole } from '@/lib/auth/session'
import {
  retryScalpSessionAnalysis,
  scalpAnalysisErrorStatus,
  toScalpAnalysisError,
} from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { sessionId } = await params
  try {
    return jsonNoStore(await retryScalpSessionAnalysis(sessionId))
  } catch (error) {
    return NextResponse.json(
      { error: toScalpAnalysisError(error) },
      { status: scalpAnalysisErrorStatus(error) },
    )
  }
}
