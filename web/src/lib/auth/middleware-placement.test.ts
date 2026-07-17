import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'

test('Next auth middleware lives beside the src app directory', () => {
  assert.equal(existsSync(path.join(process.cwd(), 'src', 'middleware.ts')), true)
  assert.equal(existsSync(path.join(process.cwd(), 'middleware.ts')), false)
})
