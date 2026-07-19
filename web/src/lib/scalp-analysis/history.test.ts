import test from 'node:test'
import assert from 'node:assert/strict'

import { buildScalpAnalysisHistory } from './history'

const summary = (sessionId: string, areaKey: 'm_left' | 'crown', baby: number) => ({
  session_id: sessionId,
  area_key: areaKey,
  average_coarse_hair_count: 20,
  average_baby_hair_count: baby,
  average_empty_follicle_count: 3,
  average_blockage_count: 2,
  average_scalp_empty_ratio: 32,
  average_redness_score: 2,
  average_oiliness_score: 4,
  average_density_score: 70,
})

test('buildScalpAnalysisHistory sorts completed area summaries chronologically', () => {
  const history = buildScalpAnalysisHistory(
    [
      { id: 'newer', check_date: '2026-03-01T00:00:00.000Z' },
      { id: 'older', check_date: '2026-01-01T00:00:00.000Z' },
    ],
    [summary('newer', 'm_left', 8), summary('older', 'm_left', 3), summary('newer', 'crown', 5)],
  )

  assert.deepEqual(
    history.map((item) => `${item.area_key}:${item.session_id}`),
    ['m_left:older', 'm_left:newer', 'crown:newer'],
  )
  assert.equal(history[1]?.baby_hair_count, 8)
})

test('buildScalpAnalysisHistory ignores summaries whose session is missing', () => {
  const history = buildScalpAnalysisHistory(
    [{ id: 'known', check_date: '2026-01-01T00:00:00.000Z' }],
    [summary('unknown', 'm_left', 99)],
  )

  assert.deepEqual(history, [])
})
