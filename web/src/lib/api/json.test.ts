import test from 'node:test'
import assert from 'node:assert/strict'

import { readJsonBody } from './json'

test('readJsonBody returns parsed JSON for a valid request body', async () => {
  const result = await readJsonBody<{ name: string }>(
    new Request('https://example.test/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'Pandora' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.body, { name: 'Pandora' })
  }
})

test('readJsonBody returns invalid_json for malformed request body', async () => {
  const result = await readJsonBody(
    new Request('https://example.test/api', {
      method: 'POST',
      body: '{broken',
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  assert.deepEqual(result, {
    ok: false,
    error: 'invalid_json',
  })
})
