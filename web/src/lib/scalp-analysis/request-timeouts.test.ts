import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SCALP_ANALYSIS_IMAGE_REQUEST_TIMEOUT_MS,
  SCALP_ANALYSIS_RECOVERY_REQUEST_TIMEOUT_MS,
  SCALP_ANALYSIS_STORAGE_CLEANUP_REQUEST_TIMEOUT_MS,
} from './request-timeouts'

test('scalp analysis image requests allow storage and vision processing to finish', () => {
  assert.ok(SCALP_ANALYSIS_IMAGE_REQUEST_TIMEOUT_MS >= 90_000)
  assert.ok(SCALP_ANALYSIS_RECOVERY_REQUEST_TIMEOUT_MS >= SCALP_ANALYSIS_IMAGE_REQUEST_TIMEOUT_MS)
  assert.ok(SCALP_ANALYSIS_STORAGE_CLEANUP_REQUEST_TIMEOUT_MS >= SCALP_ANALYSIS_IMAGE_REQUEST_TIMEOUT_MS)
})
