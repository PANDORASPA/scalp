import { NextResponse } from 'next/server'

import { jsonNoStore } from '@/lib/api/response'
import { requireAuthRole } from '@/lib/auth/session'
import { getScalpAnalysisHistory, toScalpAnalysisError } from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const customerId = new URL(req.url).searchParams.get('customerId') ?? ''
  if (!customerId) return NextResponse.json({ error: 'customer_id_required' }, { status: 400 })

  try {
    return jsonNoStore(await getScalpAnalysisHistory(customerId))
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
