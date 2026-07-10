import test from 'node:test'
import assert from 'node:assert/strict'

import { jsonNoStore } from './response'

test('jsonNoStore returns JSON with no-store cache headers', async () => {
  const response = jsonNoStore({ ok: true })

  assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0')
  assert.deepEqual(await response.json(), { ok: true })
})
