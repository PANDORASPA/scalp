import type { ScalpSession } from '@/lib/scalp/types'

export function pickTrackingSessionId(
  sessions: Pick<ScalpSession, 'id'>[],
  requestedSessionId: string | null | undefined,
  currentSessionId: string | null | undefined,
) {
  const available = new Set(sessions.map((session) => session.id))
  if (requestedSessionId && available.has(requestedSessionId)) return requestedSessionId
  if (currentSessionId && available.has(currentSessionId)) return currentSessionId
  return sessions[0]?.id ?? ''
}

export function buildScalpAnalysisHref(customerId: string, sessionId?: string | null) {
  const params = [`customerId=${encodeURIComponent(customerId)}`]
  if (sessionId) params.push(`sessionId=${encodeURIComponent(sessionId)}`)
  return `/scalp-analysis?${params.join('&')}`
}
