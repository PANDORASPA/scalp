import test from 'node:test'
import assert from 'node:assert/strict'

import type { ScalpSession } from '../scalp/types'
import { readDb, updateDb } from './store'

test('updateDb serializes concurrent local writes instead of losing records', async () => {
  const marker = `store-test-${crypto.randomUUID()}`
  const buildSession = (index: number): ScalpSession => ({
    id: `${marker}-${index}`,
    customer_id: marker,
    check_date: '2026-07-19T00:00:00.000Z',
    staff_name: null,
    notes: null,
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
  })

  try {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        updateDb((db) => ({
          db: { ...db, sessions: [...db.sessions, buildSession(index)] },
          result: undefined,
        })),
      ),
    )
    const db = await readDb()
    assert.equal(db.sessions.filter((session) => session.customer_id === marker).length, 10)
  } finally {
    await updateDb((db) => ({
      db: { ...db, sessions: db.sessions.filter((session) => session.customer_id !== marker) },
      result: undefined,
    }))
  }
})
