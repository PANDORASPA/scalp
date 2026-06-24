import test from 'node:test'
import assert from 'node:assert/strict'

import { keepExistingSecretUnlessReplacement } from './secret-merge'

test('keepExistingSecretUnlessReplacement preserves existing secrets for empty input', () => {
  assert.equal(keepExistingSecretUnlessReplacement(undefined, 'existing-key'), 'existing-key')
  assert.equal(keepExistingSecretUnlessReplacement('', 'existing-key'), 'existing-key')
  assert.equal(keepExistingSecretUnlessReplacement('   ', 'existing-key'), 'existing-key')
})

test('keepExistingSecretUnlessReplacement accepts a non-empty replacement secret', () => {
  assert.equal(keepExistingSecretUnlessReplacement('new-key', 'existing-key'), 'new-key')
  assert.equal(keepExistingSecretUnlessReplacement('  new-key  ', 'existing-key'), '  new-key  ')
})
