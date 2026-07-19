import { hasSessionWorkflow } from '@/lib/scalp/ownership'
import type { Customer, ScalpPointSummary, ScalpSession } from '@/lib/scalp/types'

export function buildCustomerOverview(input: {
  customer: Customer | null
  sessions: ScalpSession[]
  pointSummaries: ScalpPointSummary[]
}) {
  if (!input.customer) return null

  const sessions = input.sessions
    .filter((session) => session.customer_id === input.customer?.id)
    .filter((session) => hasSessionWorkflow(session, 'legacy_capture'))
    .sort(
      (a, b) =>
        b.check_date.localeCompare(a.check_date) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    )
  const latestSession = sessions[0] ?? null
  const latestSummaries = latestSession
    ? input.pointSummaries
        .filter((summary) => summary.session_id === latestSession.id)
        .sort((a, b) => a.capture_point_code.localeCompare(b.capture_point_code))
    : []

  return {
    customer: input.customer,
    sessions,
    latestSession,
    latestSummaries,
  }
}
