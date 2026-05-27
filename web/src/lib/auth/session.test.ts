import test from 'node:test'
import assert from 'node:assert/strict'

import { authenticateUser, createSessionToken, parseSessionToken } from './core'

test('authenticateUser returns a session for valid credentials', () => {
  const session = authenticateUser('admin', 'admin123')
  assert.ok(session)
  assert.equal(session?.role, 'admin')
})

test('parseSessionToken restores encoded session payload', () => {
  const token = createSessionToken({
    username: 'staff',
    name: 'Front Desk',
    role: 'staff',
  })

  const parsed = parseSessionToken(token)
  assert.deepEqual(parsed, {
    username: 'staff',
    name: 'Front Desk',
    role: 'staff',
  })
})
