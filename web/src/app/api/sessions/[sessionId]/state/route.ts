import { NextResponse } from 'next/server'

import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import { getSessionStateFromSupabase, toRepositoryError } from '@/lib/supabase/repository'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params

  if (hasSupabaseServerEnv()) {
    try {
      const result = await getSessionStateFromSupabase(sessionId)
      if (!result) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      return NextResponse.json(result)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const session = db.sessions.find((s) => s.id === sessionId) ?? null
    if (!session) return { db, result: null }
    const customer = db.customers.find((c) => c.id === session.customer_id) ?? null
    const images = db.images.filter((img) => img.session_id === sessionId)
    const metricsByImageId = Object.fromEntries(
      db.metrics
        .filter((m) => images.some((i) => i.id === m.image_id))
        .map((m) => [m.image_id, m]),
    )
    const pointSummaries = db.pointSummaries.filter((p) => p.session_id === sessionId)
    const comparisons = db.comparisons.filter((c) => c.current_session_id === sessionId)
    const aiShotAnalysesByImageId = Object.fromEntries(
      db.aiShotAnalyses
        .filter((item) => images.some((i) => i.id === item.image_id))
        .map((item) => [item.image_id, item]),
    )
    const aiPointAnalyses = db.aiPointAnalyses.filter((item) => item.session_id === sessionId)

    return {
      db,
      result: {
        session,
        customer,
        images,
        metricsByImageId,
        pointSummaries,
        comparisons,
        aiShotAnalysesByImageId,
        aiPointAnalyses,
      },
    }
  })

  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(result)
}
