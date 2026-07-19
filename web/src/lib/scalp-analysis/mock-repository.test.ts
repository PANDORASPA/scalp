import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  createTrackingSessionRecord,
  getTrackingImageBySlot,
  getTrackingSessionStateRecord,
  updateTrackingImageRecord,
  upsertTrackingImageRecord,
} from './mock-repository'
import { updateDb } from '../mockdb/store'

test('mock tracking repository supports session state and slot upsert', async () => {
  const session = await createTrackingSessionRecord({
    customerId: 'customer-test',
    checkDate: '2026-07-18T00:00:00.000Z',
    notes: 'local test',
    nowISO: '2026-07-18T00:00:00.000Z',
  })

  try {
    const first = await upsertTrackingImageRecord({
    customerId: session.customer_id,
    sessionId: session.id,
    areaKey: 'm_left',
    imageIndex: 1,
    imageUrl: 'data:image/svg+xml,first',
    driveFileId: 'demo-first',
    storageProvider: 'demo',
    storageObjectKey: 'customer-test/session/m_left/1.jpg',
    analysisStatus: 'uploaded',
    nowISO: '2026-07-18T00:00:01.000Z',
    })
    const second = await upsertTrackingImageRecord({
    customerId: session.customer_id,
    sessionId: session.id,
    areaKey: 'm_left',
    imageIndex: 1,
    imageUrl: 'data:image/svg+xml,second',
    driveFileId: 'demo-second',
    storageProvider: 'demo',
    storageObjectKey: 'customer-test/session/m_left/1.jpg',
    analysisStatus: 'uploaded',
    nowISO: '2026-07-18T00:00:02.000Z',
    })

    assert.equal(first.id, second.id)
    assert.equal((await getTrackingImageBySlot(session.id, 'm_left', 1))?.image_url, 'data:image/svg+xml,second')
    const incompleteConfirmed = await upsertTrackingImageRecord({
      customerId: session.customer_id,
      sessionId: session.id,
      areaKey: 'm_left',
      imageIndex: 2,
      imageUrl: 'data:image/svg+xml,incomplete-confirmed',
      driveFileId: 'demo-incomplete-confirmed',
      storageProvider: 'demo',
      storageObjectKey: 'customer-test/session/m_left/2.jpg',
      analysisStatus: 'confirmed',
      nowISO: '2026-07-18T00:00:03.000Z',
    })
    await updateTrackingImageRecord(incompleteConfirmed.id, {
      analysis_status: 'confirmed',
      updated_at: '2026-07-18T00:00:04.000Z',
    })
    const state = await getTrackingSessionStateRecord(session.id)
    assert.equal(state?.progress.uploaded_images, 2)
    assert.equal(state?.areas.find((area) => area.area_key === 'm_left')?.missing_images, 1)
    assert.equal(state?.areas.find((area) => area.area_key === 'm_left')?.confirmed_images, 0)
    assert.equal(state?.areas.find((area) => area.area_key === 'm_left')?.pending_confirmation_images, 2)
  } finally {
    await updateDb((db) => ({
      db: {
        ...db,
        sessions: db.sessions.filter((item) => item.id !== session.id),
        trackingImages: (db.trackingImages ?? []).filter((item) => item.session_id !== session.id),
        trackingAreaSummaries: (db.trackingAreaSummaries ?? []).filter((item) => item.session_id !== session.id),
      },
      result: undefined,
    }))
  }
})
