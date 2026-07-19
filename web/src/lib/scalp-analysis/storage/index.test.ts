import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveScalpStorageProvider } from './index'

test('local development without Supabase defaults tracking storage to demo', () => {
  assert.equal(resolveScalpStorageProvider(undefined, {} as NodeJS.ProcessEnv), 'demo')
})

test('deployed runtimes default tracking storage to Google Drive', () => {
  assert.equal(resolveScalpStorageProvider(undefined, { VERCEL: '1' } as NodeJS.ProcessEnv), 'google-drive')
})

test('explicit storage configuration always wins over runtime defaults', () => {
  assert.equal(resolveScalpStorageProvider('google-drive', {} as NodeJS.ProcessEnv), 'google-drive')
  assert.equal(resolveScalpStorageProvider('demo', { VERCEL: '1' } as NodeJS.ProcessEnv), 'demo')
})

test('configured Supabase local environments keep Google Drive as the default', () => {
  assert.equal(
    resolveScalpStorageProvider(
      undefined,
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: `eyJ${'a'.repeat(120)}.${'b'.repeat(20)}.${'c'.repeat(20)}`,
      } as NodeJS.ProcessEnv,
    ),
    'google-drive',
  )
})
