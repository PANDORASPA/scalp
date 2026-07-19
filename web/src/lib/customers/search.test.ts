import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeCustomerSearchResults } from './search'

test('mergeCustomerSearchResults removes duplicate customers and keeps newest first', () => {
  const result = mergeCustomerSearchResults([
    [
      { id: 'one', updated_at: '2026-07-18T00:00:00.000Z' },
      { id: 'same', updated_at: '2026-07-17T00:00:00.000Z' },
    ],
    [
      { id: 'same', updated_at: '2026-07-19T00:00:00.000Z' },
      { id: 'two', updated_at: '2026-07-16T00:00:00.000Z' },
    ],
  ])

  assert.deepEqual(result.map((item) => item.id), ['same', 'one', 'two'])
  assert.equal(result[0]?.updated_at, '2026-07-19T00:00:00.000Z')
})
