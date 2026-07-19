import type { ScalpSession } from './types'

export type SessionWorkflow = 'legacy_capture' | 'scalp_analysis_tracking'

export function hasSessionWorkflow(
  session: Pick<ScalpSession, 'workflow_type'> | null | undefined,
  expectedWorkflow: SessionWorkflow,
) {
  if (!session) return false
  return (session.workflow_type ?? 'legacy_capture') === expectedWorkflow
}

export function belongsToSessionOwner(
  session: Pick<ScalpSession, 'id' | 'customer_id' | 'workflow_type'> | null | undefined,
  customerId: string,
  expectedWorkflow: SessionWorkflow,
) {
  if (!session || session.customer_id !== customerId) return false
  return hasSessionWorkflow(session, expectedWorkflow)
}
