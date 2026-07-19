import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SUPABASE_REQUIRED_TABLES,
  getMissingCapturePointCodes,
} from './supabase-connectivity'

test('Supabase readiness requires every production table used by the app', () => {
  assert.deepEqual(
    [...SUPABASE_REQUIRED_TABLES],
    [
      'customers',
      'scalp_sessions',
      'scalp_capture_points',
      'scalp_images',
      'scalp_image_metrics',
      'scalp_point_summaries',
      'scalp_comparisons',
      'scalp_ai_shot_analyses',
      'scalp_ai_point_analyses',
      'scalp_area_summaries',
      'app_settings',
    ],
  )
})

test('Supabase readiness reports missing fixed scalp capture points', () => {
  assert.deepEqual(
    getMissingCapturePointCodes(['m_left', 'm_right', 'crown']),
    ['front_center', 'vertex', 'occipital_control'],
  )
  assert.deepEqual(
    getMissingCapturePointCodes(['m_left', 'm_right', 'front_center', 'crown', 'vertex', 'occipital_control']),
    [],
  )
})
