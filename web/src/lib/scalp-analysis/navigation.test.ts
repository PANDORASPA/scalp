import test from 'node:test'
import assert from 'node:assert/strict'

import { buildScalpAnalysisHref, pickTrackingSessionId } from './navigation'

const sessions = [
  { id: 'newer', customer_id: 'customer-1' },
  { id: 'older', customer_id: 'customer-1' },
]

test('pickTrackingSessionId restores a requested session when it belongs to the list', () => {
  assert.equal(pickTrackingSessionId(sessions, 'older', 'newer'), 'older')
})

test('pickTrackingSessionId ignores stale URLs and keeps the current selection', () => {
  assert.equal(pickTrackingSessionId(sessions, 'missing', 'older'), 'older')
  assert.equal(pickTrackingSessionId(sessions, 'missing', 'missing'), 'newer')
  assert.equal(pickTrackingSessionId([], 'missing', 'older'), '')
})

test('buildScalpAnalysisHref preserves customer and optional session selection', () => {
  assert.equal(buildScalpAnalysisHref('customer 1'), '/scalp-analysis?customerId=customer%201')
  assert.equal(
    buildScalpAnalysisHref('customer 1', 'session/2'),
    '/scalp-analysis?customerId=customer%201&sessionId=session%2F2',
  )
})
