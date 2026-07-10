import test from 'node:test'
import assert from 'node:assert/strict'

import { getSupabaseServerEnvIssue, hasSupabaseServerEnv } from './supabase'

const validJwtShape = `eyJ${'a'.repeat(40)}.eyJ${'b'.repeat(40)}.${'c'.repeat(80)}`

test('getSupabaseServerEnvIssue reports missing or invalid Supabase URL', () => {
  assert.equal(
    getSupabaseServerEnvIssue({
      SUPABASE_SERVICE_ROLE_KEY: validJwtShape,
    } as NodeJS.ProcessEnv),
    'SUPABASE_URL is missing.',
  )
  assert.equal(
    getSupabaseServerEnvIssue({
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: validJwtShape,
    } as NodeJS.ProcessEnv),
    'SUPABASE_URL is missing.',
  )
  assert.equal(
    getSupabaseServerEnvIssue({
      SUPABASE_URL: 'not-a-url',
      SUPABASE_SERVICE_ROLE_KEY: validJwtShape,
    } as NodeJS.ProcessEnv),
    'SUPABASE_URL is not a valid URL.',
  )
})

test('getSupabaseServerEnvIssue rejects short non-JWT service keys', () => {
  assert.equal(
    getSupabaseServerEnvIssue({
      SUPABASE_URL: 'https://rpmnwlrfwrxyjbclbtsq.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: '""',
    } as NodeJS.ProcessEnv),
    'SUPABASE_SERVICE_ROLE_KEY does not look like a valid service role JWT.',
  )
  assert.equal(
    hasSupabaseServerEnv({
      SUPABASE_URL: 'https://rpmnwlrfwrxyjbclbtsq.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: '""',
    } as NodeJS.ProcessEnv),
    false,
  )
})

test('hasSupabaseServerEnv accepts valid Supabase URL and service key shape', () => {
  assert.equal(
    getSupabaseServerEnvIssue({
      SUPABASE_URL: 'https://rpmnwlrfwrxyjbclbtsq.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: validJwtShape,
    } as NodeJS.ProcessEnv),
    null,
  )
  assert.equal(
    hasSupabaseServerEnv({
      SUPABASE_URL: 'https://rpmnwlrfwrxyjbclbtsq.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: validJwtShape,
    } as NodeJS.ProcessEnv),
    true,
  )
})
