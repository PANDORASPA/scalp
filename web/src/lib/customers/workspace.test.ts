import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCustomerWorkspaceRows, buildCustomerWorkspaceRowsFromLocalSnapshot } from './workspace'

test('buildCustomerWorkspaceRows derives workflow states', () => {
  const { rows, summary } = buildCustomerWorkspaceRows({
    customers: [
      {
        id: 'c1',
        name: 'Alpha',
        phone: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'c2',
        name: 'Beta',
        phone: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      },
    ],
    sessions: [
      {
        id: 's1',
        customer_id: 'c2',
        check_date: '2026-03-01T00:00:00.000Z',
        staff_name: null,
        notes: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 's2',
        customer_id: 'c2',
        check_date: '2026-03-15T00:00:00.000Z',
        staff_name: null,
        notes: null,
        created_at: '2026-03-15T00:00:00.000Z',
        updated_at: '2026-03-15T00:00:00.000Z',
      },
    ],
    pointSummaries: [
      {
        id: 'p1',
        customer_id: 'c2',
        session_id: 's2',
        capture_point_code: 'front',
        oil_avg: 1,
        redness_avg: 1,
        density_avg: 1,
        blockage_avg: 1,
        dandruff_avg: 1,
        sensitivity_avg: 1,
        completed: true,
        computed_at: '2026-03-15T00:00:00.000Z',
      },
    ],
  })

  const alpha = rows.find((row) => row.id === 'c1')
  const beta = rows.find((row) => row.id === 'c2')

  assert.equal(alpha?.needs_session, true)
  assert.equal(beta?.needs_capture, true)
  assert.equal(beta?.latest_completed_points, 1)
  assert.equal(summary.needs_session, 1)
  assert.equal(summary.needs_capture, 1)
})

test('buildCustomerWorkspaceRows keeps tracking workflow progress visible beside legacy sessions', () => {
  const result = buildCustomerWorkspaceRows({
    customers: [
      {
        id: 'c1',
        name: 'Tracking only',
        phone: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    sessions: [],
    pointSummaries: [],
    trackingSessions: [
      {
        id: 'tracking-1',
        customer_id: 'c1',
        check_date: '2026-03-20T00:00:00.000Z',
        staff_name: null,
        notes: null,
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
      },
    ],
    trackingCompletedAreas: [
      { customer_id: 'c1', session_id: 'tracking-1' },
      { customer_id: 'c1', session_id: 'tracking-1' },
    ],
  })

  assert.equal(result.rows[0]?.tracking_session_count, 1)
  assert.equal(result.rows[0]?.latest_tracking_completed_areas, 2)
  assert.equal(result.rows[0]?.latest_tracking_check_date, '2026-03-20T00:00:00.000Z')
})

test('local workspace snapshots include tracking progress in the same way as Supabase snapshots', () => {
  const result = buildCustomerWorkspaceRowsFromLocalSnapshot({
    customers: [
      {
        id: 'c1',
        name: 'Local tracking customer',
        phone: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
      },
    ],
    sessions: [
      {
        id: 'tracking-1',
        customer_id: 'c1',
        check_date: '2026-03-20T00:00:00.000Z',
        staff_name: null,
        notes: null,
        workflow_type: 'scalp_analysis_tracking',
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
      },
    ],
    pointSummaries: [],
    trackingCompletedAreas: [
      { customer_id: 'c1', session_id: 'tracking-1' },
      { customer_id: 'c1', session_id: 'tracking-1' },
    ],
  })

  assert.equal(result.summary.tracking_active, 1)
  assert.equal(result.summary.tracking_incomplete, 1)
  assert.equal(result.rows[0]?.latest_tracking_completed_areas, 2)
})
