import { strict as assert } from 'node:assert'
import test from 'node:test'

import { updateDb } from '../mockdb/store'
import {
  createScalpSession,
  cleanupScalpSessionStorage,
  buildConfirmedImagePatch,
  getScalpAnalysisSessionState,
  retryScalpSessionAnalysis,
  saveConfirmedAnnotations,
  updateScalpSession,
  scalpAnalysisErrorStatus,
  toScalpAnalysisError,
} from './service'
import { getTrackingAreaSummary, updateTrackingImageRecord, upsertTrackingImageRecord } from './repository'
import { createEmptyAnnotations } from './logic'
import type { ScalpStorageAdapter } from './storage/types'

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
  result.scores.redness_score = 0
  result.scores.oiliness_score = 0
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

test('editing a tracking session date recomputes previous and baseline references', async () => {
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
          name: 'Session date test customer',
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
    assert.equal(
      (await getTrackingAreaSummary(second.id, 'm_left'))?.compared_to_previous_json?.reference_session_id,
      first.id,
    )

    await updateScalpSession(first.id, {
      sessionDate: '2026-03-01T00:00:00.000Z',
      notes: 'Corrected capture date',
    })

    const earlier = await getTrackingAreaSummary(second.id, 'm_left')
    const latest = await getTrackingAreaSummary(first.id, 'm_left')
    assert.equal(earlier?.compared_to_previous_json, null)
    assert.equal(earlier?.compared_to_baseline_json, null)
    assert.equal(latest?.compared_to_previous_json?.reference_session_id, second.id)
    assert.equal(latest?.compared_to_baseline_json?.reference_session_id, second.id)
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

test('confirmed annotation patch keeps annotations and derived stats atomic', () => {
  const input = annotations(4)
  input.coarse_hairs = [{ id: 'coarse-1', x: 10, y: 12, confidence: 0.9 }]
  input.empty_follicles = [{ id: 'empty-1', x: 20, y: 22, confidence: 0.8 }]
  input.blockages = [{ id: 'blockage-1', x: 30, y: 32, radius: 10, confidence: 0.7 }]
  input.scores.redness_score = 3
  input.scores.oiliness_score = 6

  const patch = buildConfirmedImagePatch(input, '2026-07-19T12:00:00.000Z')

  assert.equal(patch.analysis_status, 'confirmed')
  assert.equal(patch.confirmed_annotations_json, input)
  assert.equal(patch.analysis_notes, input.notes)
  assert.equal(patch.updated_at, '2026-07-19T12:00:00.000Z')
  assert.deepEqual(
    {
      coarse_hair_count: patch.coarse_hair_count,
      baby_hair_count: patch.baby_hair_count,
      empty_follicle_count: patch.empty_follicle_count,
      blockage_count: patch.blockage_count,
      scalp_empty_ratio: patch.scalp_empty_ratio,
      redness_score: patch.redness_score,
      oiliness_score: patch.oiliness_score,
      density_score: patch.density_score,
    },
    {
      coarse_hair_count: 1,
      baby_hair_count: 4,
      empty_follicle_count: 1,
      blockage_count: 1,
      scalp_empty_ratio: 35,
      redness_score: 3,
      oiliness_score: 6,
      density_score: 60,
    },
  )
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

test('tracking sessions keep the authenticated operator name for auditability', async () => {
  const customerId = `customer-${crypto.randomUUID()}`
  const now = new Date().toISOString()
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
          name: 'Audit test customer',
          phone: null,
          notes: null,
          created_at: now,
          updated_at: now,
        },
      ],
    },
    result: undefined,
  }))

  try {
    const session = await createScalpSession(customerId, {
      sessionDate: '2026-03-01T00:00:00.000Z',
      staffName: 'Front Desk',
    })
    assert.equal(session.staff_name, 'Front Desk')
  } finally {
    await updateDb((db) => ({
      db: {
        ...db,
        sessions: db.sessions.filter((item) => item.customer_id !== customerId),
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

test('session AI recovery retries only incomplete images and isolates per-image failures', async () => {
  const customerId = `customer-${crypto.randomUUID()}`
  const now = new Date().toISOString()
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
          name: 'Recovery test customer',
          phone: null,
          notes: null,
          created_at: now,
          updated_at: now,
        },
      ],
    },
    result: undefined,
  }))

  const session = await createScalpSession(customerId, { sessionDate: '2026-04-01T00:00:00.000Z' })
  const statuses = ['uploaded', 'ai_failed', 'ai_ready', 'confirmed'] as const
  const images: Array<Awaited<ReturnType<typeof upsertTrackingImageRecord>>> = []
  for (const [offset, status] of statuses.entries()) {
    images.push(
      await upsertTrackingImageRecord({
        customerId,
        sessionId: session.id,
        areaKey: 'm_left',
        imageIndex: (offset + 1) as 1 | 2 | 3,
        imageUrl: `https://example.test/recovery-${offset}`,
        driveFileId: `demo-recovery-${offset}`,
        storageProvider: 'demo',
        storageObjectKey: `${customerId}/${session.id}/m_left/${offset + 1}.jpg`,
        analysisStatus: status,
        aiResultJson: status === 'ai_ready' ? annotations(1) : undefined,
        confirmedAnnotationsJson: status === 'confirmed' ? annotations(1) : undefined,
        nowISO: now,
      }),
    )
  }

  const attempted: string[] = []
  try {
    const result = await retryScalpSessionAnalysis(session.id, async (imageId) => {
      attempted.push(imageId)
      if (imageId === images[1].id) throw new Error('provider temporarily unavailable')
      return updateTrackingImageRecord(imageId, {
        analysis_status: 'ai_ready',
        ai_result_json: annotations(2),
        analysis_notes: 'Retried successfully',
        updated_at: new Date().toISOString(),
      })
    })

    assert.deepEqual([...attempted].sort(), [images[0].id, images[1].id].sort())
    assert.equal(result.attempted, 2)
    assert.equal(result.succeeded, 1)
    assert.equal(result.failed, 1)
    assert.equal(result.skipped, 2)
    assert.deepEqual(result.results, [
      { image_id: images[0].id, status: 'ready' },
      { image_id: images[1].id, status: 'failed', error: 'provider temporarily unavailable' },
    ])
  } finally {
    await updateDb((db) => ({
      db: {
        ...db,
        sessions: db.sessions.filter((item) => item.id !== session.id),
        trackingImages: (db.trackingImages ?? []).filter((item) => item.session_id !== session.id),
        trackingAreaSummaries: (db.trackingAreaSummaries ?? []).filter((item) => item.session_id !== session.id),
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

test('session AI recovery limits provider concurrency to three images', async () => {
  const customerId = `customer-${crypto.randomUUID()}`
  const now = new Date().toISOString()
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
          name: 'Recovery concurrency customer',
          phone: null,
          notes: null,
          created_at: now,
          updated_at: now,
        },
      ],
    },
    result: undefined,
  }))

  const session = await createScalpSession(customerId, { sessionDate: '2026-05-01T00:00:00.000Z' })
  const slots: Array<{ areaKey: 'm_left' | 'm_right'; imageIndex: 1 | 2 | 3 }> = [
    { areaKey: 'm_left', imageIndex: 1 },
    { areaKey: 'm_left', imageIndex: 2 },
    { areaKey: 'm_left', imageIndex: 3 },
    { areaKey: 'm_right', imageIndex: 1 },
  ]
  try {
    for (const slot of slots) {
      await upsertTrackingImageRecord({
        customerId,
        sessionId: session.id,
        areaKey: slot.areaKey,
        imageIndex: slot.imageIndex,
        imageUrl: `https://example.test/concurrency-${slot.areaKey}-${slot.imageIndex}`,
        driveFileId: `demo-concurrency-${slot.areaKey}-${slot.imageIndex}`,
        storageProvider: 'demo',
        storageObjectKey: `${customerId}/${session.id}/${slot.areaKey}/${slot.imageIndex}.jpg`,
        analysisStatus: 'ai_failed',
        nowISO: now,
      })
    }

    let active = 0
    let maxActive = 0
    const result = await retryScalpSessionAnalysis(session.id, async (imageId) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 20))
      active -= 1
      return updateTrackingImageRecord(imageId, {
        analysis_status: 'ai_ready',
        ai_result_json: annotations(2),
        analysis_notes: 'Retried successfully',
        updated_at: new Date().toISOString(),
      })
    })

    assert.ok(maxActive > 1 && maxActive <= 3)
    assert.equal(result.attempted, 4)
    assert.equal(result.succeeded, 4)
    assert.equal(result.failed, 0)
  } finally {
    await updateDb((db) => ({
      db: {
        ...db,
        sessions: db.sessions.filter((item) => item.id !== session.id),
        trackingImages: (db.trackingImages ?? []).filter((item) => item.session_id !== session.id),
        trackingAreaSummaries: (db.trackingAreaSummaries ?? []).filter((item) => item.session_id !== session.id),
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

test('tracking session storage cleanup is bounded and aggregates failures', async () => {
  let active = 0
  let maxActive = 0
  const adapter: ScalpStorageAdapter = {
    provider: 'test',
    upload: async () => ({
      provider: 'test',
      fileId: 'unused',
      url: 'https://example.test/file',
      objectKey: 'unused',
      publicAccess: false,
      replacesExistingObject: false,
    }),
    delete: async (fileId) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      if (fileId === 'file-4') throw new Error('permission denied')
    },
  }
  const plans = Array.from({ length: 9 }, (_, index) => ({
    image: {
      id: `image-${index}`,
      drive_file_id: `file-${index}`,
      storage_object_key: null,
    },
    adapter,
  }))

  await assert.rejects(
    cleanupScalpSessionStorage(plans, 2),
    /storage_cleanup_failed: image-4: permission denied/,
  )
  assert.equal(maxActive, 2)
})
