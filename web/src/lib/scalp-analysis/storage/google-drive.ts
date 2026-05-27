import 'server-only'

import { createSign } from 'node:crypto'

import { getGoogleDriveEnv } from '@/lib/config/google-drive'

import type { ScalpStorageAdapter, ScalpStorageUploadInput, ScalpStorageUploadResult } from './types'

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function getAccessToken() {
  const env = getGoogleDriveEnv()
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: env.clientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: issuedAt + 3600,
    iat: issuedAt,
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const unsigned = `${encodedHeader}.${encodedPayload}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(env.privateKey)
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Drive auth failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('Google Drive auth failed: missing access token')
  return json.access_token
}

function buildMultipartBody(metadata: Record<string, unknown>, bytes: Buffer, contentType: string) {
  const boundary = `drive-${crypto.randomUUID()}`
  const chunks = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ]
  return {
    boundary,
    body: Buffer.concat(chunks.map((chunk) => (typeof chunk === 'string' ? Buffer.from(chunk) : chunk))),
  }
}

export const googleDriveStorageAdapter: ScalpStorageAdapter = {
  provider: 'google-drive',
  async upload(input: ScalpStorageUploadInput): Promise<ScalpStorageUploadResult> {
    const env = getGoogleDriveEnv()
    const accessToken = await getAccessToken()
    const metadata = {
      name: input.fileName,
      parents: [env.folderId],
      description: input.objectKey,
    }
    const multipart = buildMultipartBody(metadata, input.bytes, input.contentType)

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${multipart.boundary}`,
        },
        body: multipart.body,
      },
    )

    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`Google Drive upload failed: ${uploadRes.status} ${text}`)
    }

    const uploaded = (await uploadRes.json()) as {
      id?: string
      webViewLink?: string
      webContentLink?: string
    }
    if (!uploaded.id) throw new Error('Google Drive upload failed: missing file id')

    const permissionRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      },
    )

    if (!permissionRes.ok) {
      const text = await permissionRes.text()
      throw new Error(`Google Drive permission failed: ${permissionRes.status} ${text}`)
    }

    return {
      provider: 'google-drive',
      fileId: uploaded.id,
      url: `https://drive.google.com/uc?export=view&id=${uploaded.id}`,
      objectKey: input.objectKey,
    }
  },
  async delete(fileId: string | null) {
    if (!fileId) return
    const accessToken = await getAccessToken()
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok && res.status !== 404) {
      const text = await res.text()
      throw new Error(`Google Drive delete failed: ${res.status} ${text}`)
    }
  },
}
