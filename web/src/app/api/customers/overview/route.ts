import { NextResponse } from 'next/server'

import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { buildCustomerWorkspaceRows } from '@/lib/customers/workspace'
import { updateDb } from '@/lib/mockdb/store'
import { getWorkspaceSnapshot, toRepositoryError } from '@/lib/supabase/repository'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const mode = url.searchParams.get('mode') ?? 'list'
  const filter = (url.searchParams.get('filter') ?? 'all') as
    | 'all'
    | 'needs_session'
    | 'needs_capture'
    | 'ready_compare'
    | 'stale_follow_up'

  if (hasSupabaseServerEnv()) {
    try {
      const snapshot = await getWorkspaceSnapshot()
      const workspace = buildCustomerWorkspaceRows({
        customers: snapshot.customers,
        sessions: snapshot.sessions,
        pointSummaries: snapshot.pointSummaries,
        q,
        filter,
      })
      return NextResponse.json(mode === 'workspace' ? workspace : workspace.rows)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const workspace = buildCustomerWorkspaceRows({
      customers: db.customers,
      sessions: db.sessions,
      pointSummaries: db.pointSummaries,
      q,
      filter,
    })

    return {
      db,
      result: mode === 'workspace' ? workspace : workspace.rows,
    }
  })

  return NextResponse.json(result)
}
