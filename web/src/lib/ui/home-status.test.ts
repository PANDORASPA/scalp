import test from 'node:test'
import assert from 'node:assert/strict'

import { getWorkspaceLoadError, shouldUseSupabaseWorkspace } from './home-status'

test('deployed workspace never falls back to local mock data when Supabase env is missing', () => {
  assert.equal(shouldUseSupabaseWorkspace({ VERCEL: '1' } as NodeJS.ProcessEnv), true)
})

test('workspace load error explains Supabase connectivity failure without hiding the cause', () => {
  const result = getWorkspaceLoadError(
    new Error('getWorkspaceSnapshot failed: getaddrinfo ENOTFOUND db.example.supabase.co'),
  )

  assert.equal(result.kind, 'supabase')
  assert.match(result.message, /Supabase/)
  assert.match(result.detail, /Project Settings/)
})

test('workspace load error keeps unknown failures actionable', () => {
  const result = getWorkspaceLoadError(new Error('unexpected repository failure'))

  assert.equal(result.kind, 'unknown')
  assert.match(result.message, /工作台/)
  assert.match(result.detail, /重試/)
})
