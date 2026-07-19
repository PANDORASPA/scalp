import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { shouldUseSupabaseDataSource } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import { buildCustomerWorkspaceRows } from '@/lib/customers/workspace'
import { getWorkspaceSnapshot, toRepositoryError } from '@/lib/supabase/repository'
import { withWorkspaceLoadTimeout } from '@/lib/ui/workspace-load'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  if (shouldUseSupabaseDataSource()) {
    try {
      const snapshot = await withWorkspaceLoadTimeout(() => getWorkspaceSnapshot())
      const { summary } = buildCustomerWorkspaceRows({
        customers: snapshot.customers,
        sessions: snapshot.sessions,
        pointSummaries: snapshot.pointSummaries,
        trackingSessions: snapshot.trackingSessions,
        trackingCompletedAreas: snapshot.trackingCompletedAreas,
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
