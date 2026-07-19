import assert from 'node:assert/strict'
import test from 'node:test'

import { getIntegrationStatus, isIntegrationReady } from './integration'

test('integration helpers find readiness by key without trusting array order', () => {
  const integrations = [
    { key: 'google-drive', ready: false, mode: 'missing' as const },
    { key: 'supabase', ready: true, mode: 'official' as const },
  ]

  assert.deepEqual(getIntegrationStatus(integrations, 'supabase'), integrations[1])
  assert.equal(isIntegrationReady(integrations, 'supabase'), true)
  assert.equal(isIntegrationReady(integrations, 'google-drive'), false)
})

test('integration helpers fail closed for missing status or false readiness', () => {
  assert.equal(getIntegrationStatus([], 'supabase'), null)
  assert.equal(isIntegrationReady([], 'supabase'), false)
  assert.equal(isIntegrationReady([{ key: 'supabase', ready: false }], 'supabase'), false)
})
