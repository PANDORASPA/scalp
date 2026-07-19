import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCustomerOverview } from './overview'

test('customer overview excludes scalp tracking sessions from legacy session history', () => {
  const result = buildCustomerOverview({
    customer: {
      id: 'customer-1',
      name: 'Tracking customer',
      phone: null,
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-03-20T00:00:00.000Z',
    },
    sessions: [
      {
        id: 'tracking-session',
        customer_id: 'customer-1',
        check_date: '2026-03-20T00:00:00.000Z',
        staff_name: null,
        notes: null,
        workflow_type: 'scalp_analysis_tracking',
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
      },
      {
        id: 'legacy-session',
        customer_id: 'customer-1',
        check_date: '2026-03-01T00:00:00.000Z',
        staff_name: 'Staff',
        notes: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ],
    pointSummaries: [],
  })

  assert.equal(result?.sessions.length, 1)
  assert.equal(result?.sessions[0]?.id, 'legacy-session')
  assert.equal(result?.latestSession?.id, 'legacy-session')
})
