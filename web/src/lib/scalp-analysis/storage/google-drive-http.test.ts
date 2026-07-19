import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import { fetchWithGoogleDriveTimeout } from './google-drive-http'

test('Google Drive HTTP requests abort when the timeout is exceeded', async () => {
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end('{}')
    }, 50)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')

  await assert.rejects(
    fetchWithGoogleDriveTimeout(`http://127.0.0.1:${address.port}`, {}, 5),
    /Google Drive request timed out after 5ms/,
  )

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})
