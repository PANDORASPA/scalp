import test from 'node:test'
import assert from 'node:assert/strict'

import { formatSettingsError } from './repository'

test('formatSettingsError keeps structured Supabase error details', () => {
  const message = formatSettingsError({
    code: 'PGRST205',
    message: 'Could not find the table',
    details: 'Looked for public.app_settings',
    hint: 'Run the migration first',
  })

  assert.equal(
    message,
    'PGRST205: Could not find the table | Looked for public.app_settings | Run the migration first',
  )
})

test('formatSettingsError keeps ordinary Error messages unchanged', () => {
  assert.equal(formatSettingsError(new Error('network failed')), 'network failed')
})
