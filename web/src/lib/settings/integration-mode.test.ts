import test from 'node:test'
import assert from 'node:assert/strict'

import { canUseLocalSettingsFallback, getSupabaseIntegrationMode } from './integration-mode'

test('settings only fall back to local defaults outside deployed runtimes', () => {
  assert.equal(canUseLocalSettingsFallback({} as NodeJS.ProcessEnv), true)
  assert.equal(canUseLocalSettingsFallback({ VERCEL: '1' } as NodeJS.ProcessEnv), false)
})

test('Supabase mode distinguishes missing configuration from an unavailable connection', () => {
  assert.equal(
    getSupabaseIntegrationMode({ ready: false, envIssue: 'SUPABASE_URL is missing.', deployed: true }),
    'missing',
  )
  assert.equal(
    getSupabaseIntegrationMode({ ready: false, envIssue: 'SUPABASE_URL is missing.', deployed: false }),
    'mock',
  )
  assert.equal(getSupabaseIntegrationMode({ ready: false, envIssue: null, deployed: true }), 'unavailable')
  assert.equal(getSupabaseIntegrationMode({ ready: true, envIssue: null }), 'official')
})
