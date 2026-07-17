import test from 'node:test'
import assert from 'node:assert/strict'

import { getGoogleDriveEnv, getGoogleDriveEnvFromSettings } from './google-drive'

test('Google Drive storage is private by default', () => {
  const env = getGoogleDriveEnv({
    GOOGLE_DRIVE_CLIENT_EMAIL: 'service@example.com',
    GOOGLE_DRIVE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nsecret',
    GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
  } as NodeJS.ProcessEnv)

  assert.equal(env.publicAccess, false)
  assert.equal(env.privateKey, '-----BEGIN PRIVATE KEY-----\nsecret')
})

test('Google Drive public access can be explicitly enabled', () => {
  const env = getGoogleDriveEnv({
    GOOGLE_DRIVE_CLIENT_EMAIL: 'service@example.com',
    GOOGLE_DRIVE_PRIVATE_KEY: 'key',
    GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
    GOOGLE_DRIVE_PUBLIC_ACCESS: 'true',
  } as NodeJS.ProcessEnv)
  const settingsEnv = getGoogleDriveEnvFromSettings({
    clientEmail: 'service@example.com',
    privateKey: 'key',
    folderId: 'folder-1',
    publicAccess: true,
  })

  assert.equal(env.publicAccess, true)
  assert.equal(settingsEnv.publicAccess, true)
})
