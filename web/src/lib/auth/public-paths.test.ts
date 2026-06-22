import test from 'node:test'
import assert from 'node:assert/strict'

import { isPublicPath } from './public-paths'

test('isPublicPath only allows exact auth public routes or their subpaths', () => {
  assert.equal(isPublicPath('/login'), true)
  assert.equal(isPublicPath('/api/auth/login'), true)
  assert.equal(isPublicPath('/api/auth/logout'), true)
  assert.equal(isPublicPath('/api/auth/login/extra'), true)

  assert.equal(isPublicPath('/api/auth/login-extra'), false)
  assert.equal(isPublicPath('/login-extra'), false)
  assert.equal(isPublicPath('/api/customers'), false)
})
