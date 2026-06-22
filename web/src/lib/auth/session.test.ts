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
      password: 'N8x_qr7VnZ2pL5',
      name: 'Owner',
      role: 'admin',
    },
  ])

  try {
    assert.equal(authenticateUser('admin', 'admin123'), null)
    const session = authenticateUser('owner', 'N8x_qr7VnZ2pL5')
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

test('AUTH_USERS_JSON with weak or placeholder passwords is not official-ready', () => {
  const previous = process.env.AUTH_USERS_JSON
  process.env.AUTH_USERS_JSON = JSON.stringify([
    {
      username: 'owner',
      password: 'change-this-long-password',
      name: 'Owner',
      role: 'admin',
    },
  ])

  try {
    const status = getAuthReadinessStatus()
    assert.equal(status.ready, true)
    assert.equal(status.officialReady, false)
    assert.equal(status.mode, 'demo')
    assert.match(status.details, /placeholder/)
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
