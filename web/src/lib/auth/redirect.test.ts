import test from 'node:test'
import assert from 'node:assert/strict'

import { getSafeLoginRedirect } from './redirect'

test('getSafeLoginRedirect keeps internal paths and rejects external redirects', () => {
  assert.equal(getSafeLoginRedirect('/customers?filter=needs_capture'), '/customers?filter=needs_capture')
  assert.equal(getSafeLoginRedirect('https://example.com/phishing'), '/')
  assert.equal(getSafeLoginRedirect('//example.com/phishing'), '/')
  assert.equal(getSafeLoginRedirect(''), '/')
  assert.equal(getSafeLoginRedirect(null), '/')
})
