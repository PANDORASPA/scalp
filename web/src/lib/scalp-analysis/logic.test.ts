import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateStatsFromAnnotations, compareAreaSummaries, createEmptyAnnotations } from './logic'

test('calculateStatsFromAnnotations derives counts and keeps score overrides', () => {
  const annotations = createEmptyAnnotations()
  annotations.coarse_hairs = [
    { id: 'c1', x: 20, y: 30, confidence: 0.8 },
    { id: 'c2', x: 40, y: 50, confidence: 0.81 },
  ]
  annotations.baby_hairs = [{ id: 'b1', x: 60, y: 70, confidence: 0.75 }]
  annotations.empty_follicles = [{ id: 'e1', x: 80, y: 90, confidence: 0.7 }]
  annotations.blockages = [{ id: 'blk1', x: 40, y: 80, radius: 12, confidence: 0.72 }]
  annotations.redness_regions = [{ id: 'r1', x: 100, y: 110, radius: 18, severity: 4, confidence: 0.7 }]
  annotations.scores.oiliness_score = 5
  annotations.scores.redness_score = 3
  annotations.scores.scalp_empty_ratio = 28
  annotations.scores.density_score = 66

  const stats = calculateStatsFromAnnotations(annotations)

  assert.equal(stats.coarse_hair_count, 2)
  assert.equal(stats.baby_hair_count, 1)
  assert.equal(stats.empty_follicle_count, 1)
  assert.equal(stats.blockage_count, 1)
  assert.equal(stats.redness_score, 3)
  assert.equal(stats.oiliness_score, 5)
  assert.equal(stats.scalp_empty_ratio, 28)
  assert.equal(stats.density_score, 66)
})

test('compareAreaSummaries produces deltas and readable summary lines', () => {
  const comparison = compareAreaSummaries({
    current: {
      average_baby_hair_count: 7,
      average_coarse_hair_count: 21,
      average_scalp_empty_ratio: 31,
      average_density_score: 63,
      average_redness_score: 2,
      average_oiliness_score: 3,
      average_blockage_count: 1,
    },
    reference: {
      average_baby_hair_count: 2,
      average_coarse_hair_count: 18,
      average_scalp_empty_ratio: 42,
      average_density_score: 48,
      average_redness_score: 4,
      average_oiliness_score: 5,
      average_blockage_count: 3,
    },
    referenceSessionId: 'session-1',
    referenceSessionDate: '2026-01-01T00:00:00.000Z',
  })

  assert.equal(comparison.baby_hair_count.delta, 5)
  assert.equal(comparison.baby_hair_count.direction, 'improved')
  assert.equal(comparison.scalp_empty_ratio.delta, -11)
  assert.equal(comparison.scalp_empty_ratio.direction, 'improved')
  assert.ok(comparison.summary_lines.some((line) => line.includes('幼毛')))
})
