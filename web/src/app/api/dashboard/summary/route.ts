import { NextResponse } from 'next/server'

import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import { buildCustomerWorkspaceRows } from '@/lib/customers/workspace'
import { getWorkspaceSnapshot, toRepositoryError } from '@/lib/supabase/repository'

export const runtime = 'nodejs'

export async function GET() {
  if (hasSupabaseServerEnv()) {
    try {
      const snapshot = await getWorkspaceSnapshot()
      const { summary } = buildCustomerWorkspaceRows({
        customers: snapshot.customers,
        sessions: snapshot.sessions,
        pointSummaries: snapshot.pointSummaries,
      })
      return NextResponse.json(summary)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const { summary } = buildCustomerWorkspaceRows({
      customers: db.customers,
      sessions: db.sessions,
      pointSummaries: db.pointSummaries,
    })

    return { db, result: summary }
  })

  return NextResponse.json(result)
}
