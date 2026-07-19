import test from 'node:test'
import assert from 'node:assert/strict'

import { isSupportedScalpImageBytes } from './image-validation'

test('isSupportedScalpImageBytes accepts matching PNG, JPEG, and WebP signatures', () => {
  assert.equal(
    isSupportedScalpImageBytes(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
    ),
    true,
  )
  assert.equal(
    isSupportedScalpImageBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'),
    true,
  )
  assert.equal(
    isSupportedScalpImageBytes(
      Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
      'image/webp',
    ),
    true,
  )
})

test('isSupportedScalpImageBytes rejects mismatched or truncated content', () => {
  assert.equal(isSupportedScalpImageBytes(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/png'), false)
  assert.equal(isSupportedScalpImageBytes(Uint8Array.from([0x89, 0x50]), 'image/png'), false)
  assert.equal(isSupportedScalpImageBytes(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg'), false)
  assert.equal(isSupportedScalpImageBytes(Uint8Array.from([0x00, 0x01, 0x02, 0x03]), 'image/jpeg'), false)
})
