import type { Customer, ScalpPointSummary, ScalpSession } from '@/lib/scalp/types'

export type CustomerWorkspaceRow = Customer & {
  session_count: number
  latest_check_date: string | null
  latest_completed_points: number
  needs_session: boolean
  needs_capture: boolean
  ready_compare: boolean
  stale_follow_up: boolean
}

export type CustomerWorkspaceSummary = {
  total: number
  needs_session: number
  needs_capture: number
  ready_compare: number
  stale_follow_up: number
}

export type CustomerWorkspaceFilter =
  | 'all'
  | 'needs_session'
  | 'needs_capture'
  | 'ready_compare'
  | 'stale_follow_up'

function daysSince(value: string) {
  const ms = Date.now() - new Date(value).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

export function buildCustomerWorkspaceRows(params: {
  customers: Customer[]
  sessions: ScalpSession[]
  pointSummaries: ScalpPointSummary[]
  q?: string
  filter?: CustomerWorkspaceFilter
}) {
  const { customers, sessions, pointSummaries, q = '', filter = 'all' } = params
  const query = q.trim().toLowerCase()

  const allRows = customers
    .filter((c) => {
      if (!query) return true
      return c.name.toLowerCase().includes(query) || (c.phone ?? '').toLowerCase().includes(query)
    })
    .map((customer) => {
      const customerSessions = sessions
        .filter((session) => session.customer_id === customer.id)
        .sort((a, b) => b.check_date.localeCompare(a.check_date))

      const latestSession = customerSessions[0] ?? null
      const latestCompletedPoints = latestSession
        ? pointSummaries.filter((summary) => summary.session_id === latestSession.id && summary.completed).length
        : 0

      const row: CustomerWorkspaceRow = {
        ...customer,
        session_count: customerSessions.length,
        latest_check_date: latestSession?.check_date ?? null,
        latest_completed_points: latestCompletedPoints,
        needs_session: customerSessions.length === 0,
        needs_capture: Boolean(latestSession) && latestCompletedPoints < 5,
        ready_compare: customerSessions.length >= 2 && latestCompletedPoints === 5,
        stale_follow_up: Boolean(latestSession) && daysSince(latestSession.check_date) >= 30,
      }

      return row
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const summary: CustomerWorkspaceSummary = {
    total: allRows.length,
    needs_session: allRows.filter((row) => row.needs_session).length,
    needs_capture: allRows.filter((row) => row.needs_capture).length,
    ready_compare: allRows.filter((row) => row.ready_compare).length,
    stale_follow_up: allRows.filter((row) => row.stale_follow_up).length,
  }

  const rows = allRows.filter((row) => (filter === 'all' ? true : row[filter]))

  return { rows, summary }
}
