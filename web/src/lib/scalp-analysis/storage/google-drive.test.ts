import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'

import { googleDriveStorageAdapter } from './google-drive'

test('Google Drive upload removes a file when public permission setup fails', async () => {
  const originalFetch = globalThis.fetch
  const originalEnv = {
    clientEmail: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_DRIVE_PRIVATE_KEY,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    publicAccess: process.env.GOOGLE_DRIVE_PUBLIC_ACCESS,
  }
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const calls: Array<{ url: string; method: string }> = []

  process.env.GOOGLE_DRIVE_CLIENT_EMAIL = 'scalp-test@example.iam.gserviceaccount.com'
  process.env.GOOGLE_DRIVE_PRIVATE_KEY = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  process.env.GOOGLE_DRIVE_FOLDER_ID = 'folder-test'
  process.env.GOOGLE_DRIVE_PUBLIC_ACCESS = 'true'
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? 'GET' })
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 })
    }
    if (url.includes('/upload/drive/v3/files')) {
      return new Response(JSON.stringify({ id: 'uploaded-file' }), { status: 200 })
    }
    if (url.includes('/permissions')) {
      return new Response('permission denied', { status: 403 })
    }
    if (url.includes('/drive/v3/files/uploaded-file')) {
      return new Response(null, { status: 204 })
    }
    return new Response('unexpected request', { status: 500 })
  }

  try {
    await assert.rejects(
      googleDriveStorageAdapter.upload({
        objectKey: 'customer/session/m_left/1.jpg',
        fileName: 'm-left-1.jpg',
        contentType: 'image/jpeg',
        bytes: Buffer.from('image'),
      }),
      /Google Drive permission failed: 403/,
    )
    assert.ok(
      calls.some(
        (call) => call.method === 'DELETE' && call.url.includes('/drive/v3/files/uploaded-file'),
      ),
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalEnv.clientEmail === undefined) delete process.env.GOOGLE_DRIVE_CLIENT_EMAIL
    else process.env.GOOGLE_DRIVE_CLIENT_EMAIL = originalEnv.clientEmail
    if (originalEnv.privateKey === undefined) delete process.env.GOOGLE_DRIVE_PRIVATE_KEY
    else process.env.GOOGLE_DRIVE_PRIVATE_KEY = originalEnv.privateKey
    if (originalEnv.folderId === undefined) delete process.env.GOOGLE_DRIVE_FOLDER_ID
    else process.env.GOOGLE_DRIVE_FOLDER_ID = originalEnv.folderId
    if (originalEnv.publicAccess === undefined) delete process.env.GOOGLE_DRIVE_PUBLIC_ACCESS
    else process.env.GOOGLE_DRIVE_PUBLIC_ACCESS = originalEnv.publicAccess
  }
})
