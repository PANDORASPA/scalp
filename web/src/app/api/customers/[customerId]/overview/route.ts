import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import { getCustomerOverviewFromSupabase, toRepositoryError } from '@/lib/supabase/repository'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { customerId } = await params

  if (hasSupabaseServerEnv()) {
    try {
      const result = await getCustomerOverviewFromSupabase(customerId)
      if (!result) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      return NextResponse.json(result)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const customer = db.customers.find((c) => c.id === customerId) ?? null
    if (!customer) return { db, result: null }

    const sessions = db.sessions
      .filter((s) => s.customer_id === customerId)
      .sort((a, b) => b.check_date.localeCompare(a.check_date))

    const latestSession = sessions[0] ?? null
    const latestSummaries = latestSession
      ? db.pointSummaries
          .filter((p) => p.session_id === latestSession.id)
          .sort((a, b) => a.capture_point_code.localeCompare(b.capture_point_code))
      : []

    return {
      db,
      result: {
        customer,
        sessions,
        latestSession,
        latestSummaries,
      },
    }
  })

  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(result)
}
