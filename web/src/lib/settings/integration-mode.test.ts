import test from 'node:test'
import assert from 'node:assert/strict'

import { getSupabaseIntegrationMode } from './integration-mode'

test('Supabase mode distinguishes missing configuration from an unavailable connection', () => {
  assert.equal(getSupabaseIntegrationMode({ ready: false, envIssue: 'SUPABASE_URL is missing.' }), 'missing')
  assert.equal(getSupabaseIntegrationMode({ ready: false, envIssue: null }), 'unavailable')
  assert.equal(getSupabaseIntegrationMode({ ready: true, envIssue: null }), 'official')
})
