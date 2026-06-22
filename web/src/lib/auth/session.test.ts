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
  const previousSecret = process.env.AUTH_SESSION_SECRET
  process.env.AUTH_USERS_JSON = JSON.stringify([
    {
      username: 'owner',
      password: 'N8x_qr7VnZ2pL5',
      name: 'Owner',
      role: 'admin',
    },
  ])
  process.env.AUTH_SESSION_SECRET = 'official-session-signing-key-1234567890'

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
    if (previousSecret === undefined) {
      delete process.env.AUTH_SESSION_SECRET
    } else {
      process.env.AUTH_SESSION_SECRET = previousSecret
    }
  }
})

test('official credentials still require a strong AUTH_SESSION_SECRET', () => {
  const previous = process.env.AUTH_USERS_JSON
  const previousSecret = process.env.AUTH_SESSION_SECRET
  process.env.AUTH_USERS_JSON = JSON.stringify([
    {
      username: 'owner',
      password: 'N8x_qr7VnZ2pL5',
      name: 'Owner',
      role: 'admin',
    },
  ])
  delete process.env.AUTH_SESSION_SECRET

  try {
    const status = getAuthReadinessStatus()
    assert.equal(status.ready, true)
    assert.equal(status.officialReady, false)
    assert.match(status.details, /AUTH_SESSION_SECRET/)
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_USERS_JSON
    } else {
      process.env.AUTH_USERS_JSON = previous
    }
    if (previousSecret === undefined) {
      delete process.env.AUTH_SESSION_SECRET
    } else {
      process.env.AUTH_SESSION_SECRET = previousSecret
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

test('parseSessionToken restores signed session payload', async () => {
  const token = await createSessionToken({
    username: 'staff',
    name: 'Front Desk',
    role: 'staff',
  })

  const parsed = await parseSessionToken(token)
  assert.deepEqual(parsed, {
    username: 'staff',
    name: 'Front Desk',
    role: 'staff',
  })
})

test('parseSessionToken rejects legacy or tampered session tokens', async () => {
  const legacy = Buffer.from(JSON.stringify({ username: 'admin', name: 'Admin', role: 'admin' }), 'utf8').toString(
    'base64url',
  )
  assert.equal(await parseSessionToken(legacy), null)

  const token = await createSessionToken({ username: 'staff', name: 'Front Desk', role: 'staff' })
  const [version, payload, signature] = token.split('.')
  const tamperedPayload = Buffer.from(JSON.stringify({ username: 'staff', name: 'Front Desk', role: 'admin' }), 'utf8')
    .toString('base64url')
  assert.equal(await parseSessionToken(`${version}.${tamperedPayload}.${signature}`), null)
})
