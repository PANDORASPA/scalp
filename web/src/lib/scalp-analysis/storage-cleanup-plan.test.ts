import test from 'node:test'
import assert from 'node:assert/strict'

import { planScalpImageStorageCleanup, type ScalpImageStorageCleanupRef } from './storage-cleanup-plan'

function ref(overrides: Partial<ScalpImageStorageCleanupRef>): ScalpImageStorageCleanupRef {
  return {
    customer_id: 'customer-1',
    session_id: 'session-1',
    capture_point_code: 'm_left',
    shot_index: 1,
    drive_file_id: null,
    storage_provider: null,
    storage_object_key: null,
    ...overrides,
  }
}

test('planScalpImageStorageCleanup sends Google Drive refs to Drive deletion targets', () => {
  const plan = planScalpImageStorageCleanup([
    ref({
      storage_provider: 'google-drive',
      drive_file_id: 'drive-file-1',
      storage_object_key: 'customer-1/session-1/m_left/1-photo.png',
    }),
  ])

  assert.deepEqual(plan.googleDriveTargets, [
    {
      fileId: 'drive-file-1',
      objectKey: 'customer-1/session-1/m_left/1-photo.png',
    },
  ])
  assert.deepEqual(plan.supabasePaths, [])
})

test('planScalpImageStorageCleanup skips demo storage refs', () => {
  const plan = planScalpImageStorageCleanup([
    ref({
      storage_provider: 'demo',
      drive_file_id: 'demo-file',
      storage_object_key: 'demo-object',
    }),
  ])

  assert.deepEqual(plan.googleDriveTargets, [])
  assert.deepEqual(plan.supabasePaths, [])
})

test('planScalpImageStorageCleanup uses stored object keys for Supabase-compatible refs', () => {
  const plan = planScalpImageStorageCleanup([
    ref({
      storage_provider: 'supabase',
      storage_object_key: 'custom/object/key.jpg',
    }),
  ])

  assert.deepEqual(plan.supabasePaths, ['custom/object/key.jpg'])
})

test('planScalpImageStorageCleanup rebuilds legacy Supabase paths when object key is missing', () => {
  const plan = planScalpImageStorageCleanup([
    ref({
      storage_provider: null,
      capture_point_code: 'front',
      shot_index: 3,
    }),
  ])

  assert.deepEqual(plan.supabasePaths, ['customer-1/session-1/front/3.jpg'])
})
