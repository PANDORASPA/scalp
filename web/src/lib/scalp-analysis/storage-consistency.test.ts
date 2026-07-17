import test from 'node:test'
import assert from 'node:assert/strict'

import { commitUploadedStorageRecord, deleteStorageBestEffort } from './storage-consistency'
import type { ScalpStorageAdapter, ScalpStorageUploadResult } from './storage/types'

function createAdapter(options?: { failDelete?: boolean }) {
  const deleted: Array<{ fileId: string | null; objectKey: string | null }> = []
  const adapter: ScalpStorageAdapter = {
    provider: 'test',
    async upload() {
      throw new Error('upload is not used in this unit test')
    },
    async delete(fileId, objectKey) {
      deleted.push({ fileId, objectKey })
      if (options?.failDelete) throw new Error('delete failed')
    },
  }
  return { adapter, deleted }
}

const uploaded: ScalpStorageUploadResult = {
  provider: 'test',
  fileId: 'new-file',
  objectKey: 'customer/session/area/1.jpg',
  url: 'https://example.test/new-file',
  publicAccess: false,
}

test('commitUploadedStorageRecord keeps storage when database write succeeds', async () => {
  const { adapter, deleted } = createAdapter()

  const record = await commitUploadedStorageRecord({
    adapter,
    uploaded,
    writeRecord: async () => ({ id: 'image-1' }),
  })

  assert.deepEqual(record, { id: 'image-1' })
  assert.deepEqual(deleted, [])
})

test('commitUploadedStorageRecord rolls back uploaded storage when database write fails', async () => {
  const { adapter, deleted } = createAdapter()
  const expected = new Error('database unavailable')

  await assert.rejects(
    commitUploadedStorageRecord({
      adapter,
      uploaded,
      writeRecord: async () => {
        throw expected
      },
    }),
    expected,
  )

  assert.deepEqual(deleted, [{ fileId: 'new-file', objectKey: 'customer/session/area/1.jpg' }])
})

test('deleteStorageBestEffort swallows cleanup failures and logs them', async () => {
  const { adapter, deleted } = createAdapter({ failDelete: true })
  const logs: string[] = []

  await deleteStorageBestEffort({
    adapter,
    target: { fileId: 'old-file', objectKey: 'old-key' },
    context: 'old overwritten image',
    logger: (message, error) => logs.push(`${message}: ${error instanceof Error ? error.message : String(error)}`),
  })

  assert.deepEqual(deleted, [{ fileId: 'old-file', objectKey: 'old-key' }])
  assert.equal(logs.length, 1)
  assert.match(logs[0], /old overwritten image/)
})

test('deleteStorageBestEffort skips empty cleanup targets', async () => {
  const { adapter, deleted } = createAdapter()

  await deleteStorageBestEffort({
    adapter,
    target: { fileId: null, objectKey: null },
    context: 'empty target',
  })

  assert.deepEqual(deleted, [])
})
