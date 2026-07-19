import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import { fetchJson, isAbortError } from './fetch'

test('isAbortError identifies cancelled browser requests without swallowing other errors', () => {
  const abortError = new Error('The operation was aborted')
  abortError.name = 'AbortError'

  assert.equal(isAbortError(abortError), true)
  assert.equal(isAbortError(new Error('network failed')), false)
  assert.equal(isAbortError('AbortError'), false)
})

test('fetchJson turns a hanging request into an actionable timeout error', async () => {
  const server = createServer((_request, _response) => {
    // Keep the response open long enough to exercise the client timeout.
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')

  await assert.rejects(
    fetchJson(`http://127.0.0.1:${address.port}`, undefined, 5),
    /逾時|timeout/i,
  )

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})
