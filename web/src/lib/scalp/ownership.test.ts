import test from 'node:test'
import assert from 'node:assert/strict'

import { belongsToSessionOwner, filterSessionsByWorkflow, hasSessionWorkflow } from './ownership'

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

test('session workflow checks keep legacy routes away from tracking sessions', () => {
  assert.equal(hasSessionWorkflow(legacySession, 'legacy_capture'), true)
  assert.equal(hasSessionWorkflow(legacySession, 'scalp_analysis_tracking'), false)
  assert.equal(hasSessionWorkflow({ workflow_type: undefined }, 'legacy_capture'), true)
  assert.equal(hasSessionWorkflow(null, 'legacy_capture'), false)
})

test('filterSessionsByWorkflow keeps local session lists aligned with Supabase workflow filters', () => {
  const sessions = [
    { id: 'legacy', workflow_type: 'legacy_capture' },
    { id: 'tracking', workflow_type: 'scalp_analysis_tracking' },
    { id: 'historical', workflow_type: undefined },
  ] as Array<{ id: string; workflow_type?: string }>

  assert.deepEqual(
    filterSessionsByWorkflow(sessions, 'legacy_capture').map((session) => session.id),
    ['legacy', 'historical'],
  )
  assert.deepEqual(
    filterSessionsByWorkflow(sessions, 'scalp_analysis_tracking').map((session) => session.id),
    ['tracking'],
  )
})
