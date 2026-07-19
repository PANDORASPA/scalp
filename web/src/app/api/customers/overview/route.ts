import { NextResponse } from 'next/server'

import { jsonNoStore } from '@/lib/api/response'
import { requireAuthRole } from '@/lib/auth/session'
import { shouldUseSupabaseDataSource } from '@/lib/config/supabase'
import {
  buildCustomerWorkspaceRows,
  buildCustomerWorkspaceRowsFromLocalSnapshot,
} from '@/lib/customers/workspace'
import { updateDb } from '@/lib/mockdb/store'
import { getWorkspaceSnapshot, toRepositoryError } from '@/lib/supabase/repository'
import { withWorkspaceLoadTimeout } from '@/lib/ui/workspace-load'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const mode = url.searchParams.get('mode') ?? 'list'
  const filter = (url.searchParams.get('filter') ?? 'all') as
    | 'all'
    | 'needs_session'
    | 'needs_capture'
    | 'ready_compare'
    | 'stale_follow_up'

  if (shouldUseSupabaseDataSource()) {
    try {
      const snapshot = await withWorkspaceLoadTimeout(() => getWorkspaceSnapshot())
      const workspace = buildCustomerWorkspaceRows({
        customers: snapshot.customers,
        sessions: snapshot.sessions,
        pointSummaries: snapshot.pointSummaries,
        trackingSessions: snapshot.trackingSessions,
        trackingCompletedAreas: snapshot.trackingCompletedAreas,
        q,
        filter,
      })
      return jsonNoStore(mode === 'workspace' ? workspace : workspace.rows)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const workspace = buildCustomerWorkspaceRowsFromLocalSnapshot({
      customers: db.customers,
      sessions: db.sessions,
      pointSummaries: db.pointSummaries,
      trackingCompletedAreas: db.trackingAreaSummaries?.map(({ customer_id, session_id }) => ({
        customer_id,
        session_id,
      })),
      q,
      filter,
    })

    return {
      db,
      result: mode === 'workspace' ? workspace : workspace.rows,
    }
  })

  return jsonNoStore(result)
}
