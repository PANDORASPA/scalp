import test from 'node:test'
import assert from 'node:assert/strict'

import { authenticateUser, createSessionToken, parseSessionToken } from './core'
import { getAuthReadinessStatus } from './users'

test('authenticateUser returns a session for valid credentials', () => {
  const previous = process.env.AUTH_USERS_JSON
  delete process.env.AUTH_USERS_JSON

  try {
    const session = authenticateUser('admin', 'admin123')
    assert.ok(session)
    assert.equal(session?.role, 'admin')
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_USERS_JSON
    } else {
      process.env.AUTH_USERS_JSON = previous
    }
  }
})

test('authenticateUser supports AUTH_USERS_JSON official credentials', () => {
  const previous = process.env.AUTH_USERS_JSON
  process.env.AUTH_USERS_JSON = JSON.stringify([
    {
      username: 'owner',
      password: 'strong-password',
      name: 'Owner',
      role: 'admin',
    },
  ])

  try {
    assert.equal(authenticateUser('admin', 'admin123'), null)
    const session = authenticateUser('owner', 'strong-password')
    assert.equal(session?.role, 'admin')
    assert.equal(getAuthReadinessStatus().officialReady, true)
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_USERS_JSON
    } else {
      process.env.AUTH_USERS_JSON = previous
    }
  }
})

test('invalid AUTH_USERS_JSON disables login instead of falling back to demo users', () => {
  const previous = process.env.AUTH_USERS_JSON
  process.env.AUTH_USERS_JSON = 'not json'

  try {
    assert.equal(authenticateUser('admin', 'admin123'), null)
    const status = getAuthReadinessStatus()
    assert.equal(status.ready, false)
    assert.equal(status.mode, 'missing')
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_USERS_JSON
    } else {
      process.env.AUTH_USERS_JSON = previous
    }
  }
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
