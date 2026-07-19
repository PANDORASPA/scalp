import { strict as assert } from 'node:assert'
import test from 'node:test'

import { updateDb } from '../mockdb/store'
import {
  createScalpSession,
  getScalpAnalysisSessionState,
  saveConfirmedAnnotations,
  scalpAnalysisErrorStatus,
  toScalpAnalysisError,
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
  return seedConfirmedAreaWithAnnotations(
    sessionId,
    customerId,
    [1, 2, 3].map(() => annotations(babyCount)),
  )
}

async function seedConfirmedAreaWithAnnotations(
  sessionId: string,
  customerId: string,
  annotationSet: ReturnType<typeof annotations>[],
) {
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
    await saveConfirmedAnnotations(image.id, annotationSet[imageIndex - 1])
  }
}

test('changes to an earlier session recompute downstream comparisons', async () => {
  const customerId = `customer-${crypto.randomUUID()}`
  const originalSupabaseUrl = process.env.SUPABASE_URL
  const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  await updateDb((db) => ({
    db: {
      ...db,
      customers: [
        ...db.customers,
        {
          id: customerId,
          name: 'Tracking test customer',
          phone: null,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    },
    result: undefined,
  }))

  const first = await createScalpSession(customerId, { sessionDate: '2026-01-01T00:00:00.000Z' })
  const second = await createScalpSession(customerId, { sessionDate: '2026-02-01T00:00:00.000Z' })

  try {
    await seedConfirmedArea(first.id, customerId, 1)
    await seedConfirmedArea(second.id, customerId, 2)

    // Supabase does not guarantee row order; downstream recomputation must not depend on it.
    await updateDb((db) => ({
      db: {
        ...db,
        trackingAreaSummaries: [...(db.trackingAreaSummaries ?? [])].reverse(),
      },
      result: undefined,
    }))

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
        customers: db.customers.filter((item) => item.id !== customerId),
      },
      result: undefined,
    }))
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalSupabaseUrl
    if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey
  }
})

test('createScalpSession rejects an unknown customer instead of creating an orphan record', async () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL
  const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    await assert.rejects(
      createScalpSession(`missing-customer-${crypto.randomUUID()}`),
      /customer_not_found/,
    )
  } finally {
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalSupabaseUrl
    if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey
  }
})

test('low-consistency summaries do not publish misleading session comparisons', async () => {
  const customerId = `customer-${crypto.randomUUID()}`
  const originalSupabaseUrl = process.env.SUPABASE_URL
  const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  await updateDb((db) => ({
    db: {
      ...db,
      customers: [
        ...db.customers,
        {
          id: customerId,
          name: 'Consistency gate customer',
          phone: null,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    },
    result: undefined,
  }))

  const first = await createScalpSession(customerId, { sessionDate: '2026-01-01T00:00:00.000Z' })
  const second = await createScalpSession(customerId, { sessionDate: '2026-02-01T00:00:00.000Z' })

  const noisyAnnotations = [
    annotations(1),
    {
      ...annotations(20),
      coarse_hairs: Array.from({ length: 20 }, (_, index) => ({ id: `coarse-${index}`, x: index, y: index, confidence: 0.9 })),
      empty_follicles: Array.from({ length: 20 }, (_, index) => ({ id: `empty-${index}`, x: index, y: index, confidence: 0.9 })),
      blockages: Array.from({ length: 20 }, (_, index) => ({ id: `blockage-${index}`, x: index, y: index, radius: 12, confidence: 0.9 })),
      redness_regions: Array.from({ length: 20 }, (_, index) => ({ id: `redness-${index}`, x: index, y: index, radius: 18, severity: 10 })),
      scores: { ...createEmptyAnnotations().scores, scalp_empty_ratio: 10, redness_score: 10, oiliness_score: 10, density_score: 10 },
    },
    {
      ...annotations(40),
      coarse_hairs: Array.from({ length: 40 }, (_, index) => ({ id: `coarse-${index}`, x: index, y: index, confidence: 0.9 })),
      empty_follicles: Array.from({ length: 40 }, (_, index) => ({ id: `empty-${index}`, x: index, y: index, confidence: 0.9 })),
      blockages: Array.from({ length: 40 }, (_, index) => ({ id: `blockage-${index}`, x: index, y: index, radius: 12, confidence: 0.9 })),
      scores: { ...createEmptyAnnotations().scores, scalp_empty_ratio: 90, redness_score: 0, oiliness_score: 10, density_score: 90 },
    },
  ]

  try {
    await seedConfirmedArea(first.id, customerId, 1)
    await seedConfirmedAreaWithAnnotations(second.id, customerId, noisyAnnotations)

    const current = await getTrackingAreaSummary(second.id, 'm_left')
    assert.ok(typeof current?.capture_consistency_score === 'number')
    assert.ok(current.capture_consistency_score < 70)
    assert.equal(current.compared_to_previous_json, null)
    assert.equal(current.compared_to_baseline_json, null)
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
        customers: db.customers.filter((item) => item.id !== customerId),
      },
      result: undefined,
    }))
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalSupabaseUrl
    if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey
  }
})

test('tracking errors expose stable client status codes', () => {
  assert.equal(toScalpAnalysisError(new Error('session_not_found: wrong owner')), 'session_not_found')
  assert.equal(toScalpAnalysisError(new Error('missing_image: image not found')), 'missing_image')
  assert.equal(toScalpAnalysisError(new Error('customer_not_found: missing')), 'customer_not_found')
  assert.equal(toScalpAnalysisError(new Error('invalid_image_content: signature mismatch')), 'invalid_image_content')
  assert.equal(toScalpAnalysisError(new Error('scalp_capture_points: relation "public.scalp_capture_points" does not exist')), 'supabase_schema_missing')
  assert.equal(toScalpAnalysisError(new Error('supabase_settings_unavailable: TypeError: fetch failed')), 'supabase_connection_failed')
  assert.equal(toScalpAnalysisError(new Error('Google Drive delete failed: permission denied')), 'storage_cleanup_failed')
  assert.equal(toScalpAnalysisError(new Error('storage_cleanup_failed: google-drive: permission denied')), 'storage_cleanup_failed')
  assert.equal(scalpAnalysisErrorStatus(new Error('session_not_found: wrong owner')), 404)
  assert.equal(scalpAnalysisErrorStatus(new Error('missing_image: image not found')), 404)
  assert.equal(scalpAnalysisErrorStatus(new Error('invalid_area_key: unsupported')), 400)
  assert.equal(scalpAnalysisErrorStatus(new Error('invalid_image_content: signature mismatch')), 400)
  assert.equal(scalpAnalysisErrorStatus(new Error('supabase_settings_unavailable: TypeError: fetch failed')), 503)
  assert.equal(scalpAnalysisErrorStatus(new Error('Google Drive upload failed')), 500)
})
