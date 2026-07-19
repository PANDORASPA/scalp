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

test('getHumanErrorMessage explains settings save connectivity failures', () => {
  const message = getHumanErrorMessage('save_google_drive_settings_failed: TypeError: fetch failed')

  assert.match(message, /Supabase/)
  assert.doesNotMatch(message, /save_google_drive_settings_failed/)
})

test('getHumanErrorMessage explains session ownership failures', () => {
  const message = getHumanErrorMessage('session_not_found')

  assert.match(message, /session/i)
  assert.doesNotMatch(message, /session_not_found/)
})

test('getHumanErrorMessage explains Google Drive request timeouts', () => {
  const message = getHumanErrorMessage('storage_upload_failed: Google Drive request timed out after 20000ms')

  assert.match(message, /Google Drive/i)
  assert.match(message, /timeout|稍後|網絡/i)
  assert.doesNotMatch(message, /storage_upload_failed/)
})

test('getHumanErrorMessage explains persisted settings connectivity failures', () => {
  const message = getHumanErrorMessage('scalp_analysis_error: supabase_settings_unavailable: fetch failed')

  assert.match(message, /Supabase/)
  assert.doesNotMatch(message, /supabase_settings_unavailable/)
})

test('getHumanErrorMessage explains missing Google Drive configuration', () => {
  const message = getHumanErrorMessage(
    'scalp_analysis_error: GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID are required',
  )

  assert.match(message, /Google Drive/i)
  assert.doesNotMatch(message, /GOOGLE_DRIVE_PRIVATE_KEY/)
})

test('getHumanErrorMessage explains missing Supabase schema', () => {
  const message = getHumanErrorMessage('supabase_schema_missing')

  assert.match(message, /Supabase/i)
  assert.match(message, /migration|schema/i)
  assert.doesNotMatch(message, /supabase_schema_missing/)
})

test('getHumanErrorMessage explains Supabase storage failures', () => {
  const message = getHumanErrorMessage('supabase_storage_error')

  assert.match(message, /Supabase|storage|bucket/i)
  assert.doesNotMatch(message, /supabase_storage_error/)
})

test('getHumanErrorMessage explains incomplete confirmed annotations', () => {
  const message = getHumanErrorMessage('incomplete_annotations')

  assert.match(message, /統計|紅腫|出油/)
  assert.doesNotMatch(message, /incomplete_annotations/)
})
