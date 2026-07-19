import { strict as assert } from 'node:assert'
import test from 'node:test'

import { updateDb } from '../mockdb/store'
import {
  createScalpSession,
  getScalpAnalysisSessionState,
  saveConfirmedAnnotations,
} from './service'
import { getTrackingAreaSummary, upsertTrackingImageRecord } from './repository'
import { createEmptyAnnotations } from './logic'

function annotations(babyCount: number) {
  const result = createEmptyAnnotations()
  result.baby_hairs = Array.from({ length: babyCount }, (_, index) => ({
    id: `baby-${index + 1}`,
    x: 20 + index,
    y: 30 + index,
    confidence: 0.9,
  }))
  result.scores.density_score = 60
  result.scores.scalp_empty_ratio = 35
  return result
}

async function seedConfirmedArea(sessionId: string, customerId: string, babyCount: number) {
  for (const imageIndex of [1, 2, 3] as const) {
    const image = await upsertTrackingImageRecord({
      customerId,
      sessionId,
      areaKey: 'm_left',
      imageIndex,
      imageUrl: `data:image/svg+xml,${sessionId}-${imageIndex}`,
      driveFileId: `demo-${sessionId}-${imageIndex}`,
      storageProvider: 'demo',
      storageObjectKey: `${customerId}/${sessionId}/m_left/${imageIndex}.jpg`,
      analysisStatus: 'uploaded',
      nowISO: new Date().toISOString(),
    })
    await saveConfirmedAnnotations(image.id, annotations(babyCount))
  }
}

test('changes to an earlier session recompute downstream comparisons', async () => {
  const customerId = `customer-${crypto.randomUUID()}`
  const originalSupabaseUrl = process.env.SUPABASE_URL
  const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  const first = await createScalpSession(customerId, { sessionDate: '2026-01-01T00:00:00.000Z' })
  const second = await createScalpSession(customerId, { sessionDate: '2026-02-01T00:00:00.000Z' })

  try {
    await seedConfirmedArea(first.id, customerId, 1)
    await seedConfirmedArea(second.id, customerId, 2)

    const before = await getTrackingAreaSummary(second.id, 'm_left')
    assert.equal(before?.compared_to_previous_json?.baby_hair_count.previous, 1)

    const earlierImage = (await getScalpAnalysisSessionState(first.id))?.areas
      .find((area) => area.area_key === 'm_left')?.images[0]
    assert.ok(earlierImage)
    await saveConfirmedAnnotations(earlierImage.id, annotations(10))

    const after = await getTrackingAreaSummary(second.id, 'm_left')
    assert.equal(after?.compared_to_previous_json?.baby_hair_count.previous, 4)
  } finally {
    await updateDb((db) => ({
      db: {
        ...db,
        sessions: db.sessions.filter((item) => item.id !== first.id && item.id !== second.id),
        trackingImages: (db.trackingImages ?? []).filter(
          (item) => item.session_id !== first.id && item.session_id !== second.id,
        ),
        trackingAreaSummaries: (db.trackingAreaSummaries ?? []).filter(
          (item) => item.session_id !== first.id && item.session_id !== second.id,
        ),
      },
      result: undefined,
    }))
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalSupabaseUrl
    if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey
  }
})
