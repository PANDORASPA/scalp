import test from 'node:test'
import assert from 'node:assert/strict'

import { withWorkspaceLoadTimeout } from './workspace-load'

test('workspace load timeout turns a hanging data source into a Supabase error', async () => {
  await assert.rejects(
    withWorkspaceLoadTimeout(() => new Promise(() => undefined), 5),
    /Supabase workspace load timed out after 5ms/,
  )
})

test('workspace load timeout preserves successful data', async () => {
  const result = await withWorkspaceLoadTimeout(async () => 'workspace-ready', 50)
  assert.equal(result, 'workspace-ready')
})
