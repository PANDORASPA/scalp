import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { shouldUseSupabaseDataSource } from '@/lib/config/supabase'
import { buildCustomerOverview } from '@/lib/customers/overview'
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

  if (shouldUseSupabaseDataSource()) {
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

    return {
      db,
      result: buildCustomerOverview({ customer, sessions: db.sessions, pointSummaries: db.pointSummaries }),
    }
  })

  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(result)
}
