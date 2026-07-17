import test from 'node:test'
import assert from 'node:assert/strict'

import { buildScalpImageStoragePath, isAllowedScalpImageStoragePath } from './storage-path'

const customerId = '11111111-1111-4111-8111-111111111111'
const sessionId = '22222222-2222-4222-8222-222222222222'

test('buildScalpImageStoragePath creates the stable legacy object key', () => {
  assert.equal(
    buildScalpImageStoragePath({
      customerId,
      sessionId,
      capturePointCode: 'front',
      shotIndex: 2,
    }),
    `${customerId}/${sessionId}/front/2.jpg`,
  )
})

test('isAllowedScalpImageStoragePath only accepts known private image paths', () => {
  assert.equal(isAllowedScalpImageStoragePath(`${customerId}/${sessionId}/front/1.jpg`), true)
  assert.equal(isAllowedScalpImageStoragePath(`${customerId}/${sessionId}/unknown/1.jpg`), false)
  assert.equal(isAllowedScalpImageStoragePath(`${customerId}/${sessionId}/front/4.jpg`), false)
  assert.equal(isAllowedScalpImageStoragePath(`${customerId}/${sessionId}/front/1.png`), false)
  assert.equal(isAllowedScalpImageStoragePath(`${customerId}/${sessionId}/front/../1.jpg`), false)
})
