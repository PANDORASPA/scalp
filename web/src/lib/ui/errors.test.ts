import test from 'node:test'
import assert from 'node:assert/strict'

import { getHumanErrorMessage } from './errors'

test('getHumanErrorMessage explains wrapped Supabase environment errors', () => {
  const message = getHumanErrorMessage(
    'scalp_analysis_error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required: SUPABASE_URL is missing.',
  )
  assert.match(message, /Supabase/)
  assert.doesNotMatch(message, /SUPABASE_SERVICE_ROLE_KEY is required/)
})
