import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTrackingComparisonRows, getTrackingMetricDirection } from './tracking-comparison'

const point = (overrides: Record<string, unknown> = {}) => ({
  session_id: 'session-1',
  session_date: '2026-01-01T00:00:00.000Z',
  area_key: 'm_left' as const,
  area_label: 'M 字左',
  baby_hair_count: 3,
  coarse_hair_count: 20,
  scalp_empty_ratio: 42,
  density_score: 48,
  blockage_count: 4,
  redness_score: 3,
  oiliness_score: 5,
  ...overrides,
})

test('buildTrackingComparisonRows compares each area baseline with its latest history point', () => {
  const rows = buildTrackingComparisonRows([
    point(),
    point({
      session_id: 'session-2',
      session_date: '2026-03-01T00:00:00.000Z',
      baby_hair_count: 7,
      density_score: 63,
      scalp_empty_ratio: 31,
    }),
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.ready, true)
  assert.equal(rows[0]?.baseline_session_id, 'session-1')
  assert.equal(rows[0]?.current_session_id, 'session-2')
  assert.equal(rows[0]?.metrics.baby_hair_count.delta, 4)
  assert.equal(rows[0]?.metrics.density_score.current, 63)
  assert.equal(rows[0]?.metrics.scalp_empty_ratio.delta, -11)
})

test('buildTrackingComparisonRows keeps one-session areas pending instead of inventing a trend', () => {
  const rows = buildTrackingComparisonRows([point()])

  assert.equal(rows[0]?.ready, false)
  assert.equal(rows[0]?.metrics.baby_hair_count.delta, null)
})

test('getTrackingMetricDirection treats scalp burden metrics as lower-is-better', () => {
  assert.equal(getTrackingMetricDirection('baby_hair_count', 4), 'improved')
  assert.equal(getTrackingMetricDirection('scalp_empty_ratio', -11), 'improved')
  assert.equal(getTrackingMetricDirection('redness_score', 1), 'declined')
  assert.equal(getTrackingMetricDirection('density_score', 0), 'stable')
})
