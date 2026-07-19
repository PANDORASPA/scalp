import test from 'node:test'
import assert from 'node:assert/strict'

import { belongsToSessionOwner } from './ownership'

const legacySession = {
  id: 'session-1',
  customer_id: 'customer-1',
  workflow_type: 'legacy_capture',
}

test('session ownership requires the expected customer and workflow', () => {
  assert.equal(belongsToSessionOwner(legacySession, 'customer-1', 'legacy_capture'), true)
  assert.equal(belongsToSessionOwner(legacySession, 'customer-2', 'legacy_capture'), false)
  assert.equal(belongsToSessionOwner(legacySession, 'customer-1', 'scalp_analysis_tracking'), false)
  assert.equal(belongsToSessionOwner(null, 'customer-1', 'legacy_capture'), false)
})

test('legacy sessions without workflow metadata remain compatible with local fixtures', () => {
  assert.equal(
    belongsToSessionOwner({ id: 'session-2', customer_id: 'customer-1' }, 'customer-1', 'legacy_capture'),
    true,
  )
})
