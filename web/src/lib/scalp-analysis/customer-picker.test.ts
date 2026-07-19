import test from 'node:test'
import assert from 'node:assert/strict'

import { filterScalpAnalysisCustomers } from './customer-picker'

const customers = [
  { id: 'amy', name: 'Amy Wong', phone: '0900 111 222' },
  { id: 'ben', name: 'Ben Lee', phone: '0900 333 444' },
  { id: 'carol', name: 'Carol Chan', phone: null },
]

test('customer picker searches name and phone without losing the current selection', () => {
  assert.deepEqual(
    filterScalpAnalysisCustomers(customers, '333', 'amy').map((customer) => customer.id),
    ['amy', 'ben'],
  )
  assert.deepEqual(
    filterScalpAnalysisCustomers(customers, 'carol', 'amy').map((customer) => customer.id),
    ['amy', 'carol'],
  )
})

test('customer picker returns all customers for an empty query', () => {
  assert.deepEqual(
    filterScalpAnalysisCustomers(customers, '', '').map((customer) => customer.id),
    ['amy', 'ben', 'carol'],
  )
})
