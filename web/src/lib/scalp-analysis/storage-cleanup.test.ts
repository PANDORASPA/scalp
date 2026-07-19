import test from 'node:test'
import assert from 'node:assert/strict'

import { deleteStorageTargetsWithConcurrency } from './storage-cleanup'

test('storage cleanup deletes targets with bounded concurrency and keeps failures visible', async () => {
  let active = 0
  let maxActive = 0
  const attempted: string[] = []

  const result = await deleteStorageTargetsWithConcurrency(
    ['a', 'b', 'c', 'd', 'e'],
    3,
    async (target) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      attempted.push(target)
      await new Promise((resolve) => setTimeout(resolve, 8))
      active -= 1
      if (target === 'c') throw new Error('permission denied')
    },
  )

  assert.ok(maxActive > 1 && maxActive <= 3)
  assert.deepEqual(attempted.sort(), ['a', 'b', 'c', 'd', 'e'])
  assert.deepEqual(result.failures, [{ target: 'c', message: 'permission denied' }])
})
