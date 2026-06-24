import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLoginRateLimitKey,
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
  resetLoginRateLimitForTests,
} from './login-rate-limit'

test('login rate limit locks repeated failures and clears after success', () => {
  resetLoginRateLimitForTests()
  const key = buildLoginRateLimitKey({ ip: '1.2.3.4', username: 'Admin' })

  for (let index = 0; index < 7; index += 1) {
    assert.deepEqual(recordLoginFailure(key, 1000 + index), { allowed: true })
  }

  const locked = recordLoginFailure(key, 2000)
  assert.equal(locked.allowed, false)
  if (!locked.allowed) assert.ok(locked.retryAfterSeconds > 0)
  assert.equal(checkLoginRateLimit(key, 3000).allowed, false)

  clearLoginFailures(key)
  assert.equal(checkLoginRateLimit(key, 4000).allowed, true)
})

test('login rate limit separates usernames and IP addresses', () => {
  resetLoginRateLimitForTests()
  const adminKey = buildLoginRateLimitKey({ ip: '1.2.3.4', username: 'admin' })
  const staffKey = buildLoginRateLimitKey({ ip: '1.2.3.4', username: 'staff' })
  const otherIpKey = buildLoginRateLimitKey({ ip: '5.6.7.8', username: 'admin' })

  for (let index = 0; index < 8; index += 1) recordLoginFailure(adminKey, 1000 + index)

  assert.equal(checkLoginRateLimit(adminKey, 2000).allowed, false)
  assert.equal(checkLoginRateLimit(staffKey, 2000).allowed, true)
  assert.equal(checkLoginRateLimit(otherIpKey, 2000).allowed, true)
})
