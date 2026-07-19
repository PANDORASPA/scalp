import 'server-only'

import { normalizeScalpAnalysisAiProvider } from '@/lib/config/scalp-analysis-ai'
import { explainSupabaseErrorMessage, hasSupabaseServerEnv } from '@/lib/config/supabase'
import { getAppSettings } from '@/lib/settings/repository'
import { touchCustomerInSupabase } from '@/lib/supabase/repository'

import {
  SCALP_ANALYSIS_AREA_KEYS,
  SCALP_ANALYSIS_AREA_LABELS,
  SCALP_ANALYSIS_WORKFLOW_TYPE,
  type ScalpAnalysisAreaKey,
} from './constants'
import { buildScalpAnalysisHistory } from './history'
import { analyzeScalpImage as runMockAnalyzer } from './mock-analyzer'
import { analyzeScalpImageWithOpenAi, type ScalpVisionImageSource } from './openai-vision'
import {
  buildAreaReportLine,
  calculateAreaAverages,
  calculateCaptureConsistencyScore,
  calculateStatsFromAnnotations,
  compareAreaSummaries,
  isAreaKey,
  isConfirmedScalpAnalysisImage,
  isTrustworthyCaptureConsistencyScore,
  normalizeAnnotations,
} from './logic'
import {
  createTrackingSessionRecord,
  deleteTrackingSessionRecord,
  deleteTrackingAreaSummary,
  deleteTrackingImageRecord,
  ensureScalpAnalysisCapturePoints,
  getCustomerRecord,
  getTrackingAreaSummary,
  getTrackingImageById,
  getTrackingImageBySlot,
  getTrackingSession,
  getTrackingSessionStateRecord,
  listTrackingAreaSummariesForCustomer,
  listTrackingImagesForSession,
  listTrackingSessions,
  upsertTrackingAreaSummary,
  upsertTrackingImageRecord,
  updateTrackingImageRecord,
  updateTrackingSessionRecord,
} from './repository'
import { getScalpStorageAdapter } from './storage'
import { isSupportedScalpImageBytes } from './image-validation'
import {
  commitUploadedStorageRecord,
  deleteStorageBestEffort,
  deleteStorageRequired,
  shouldRollbackUploadedStorageOnRecordFailure,
} from './storage-consistency'
import type { ScalpAnalysisAnnotations } from './types'

type UploadInput = {
  sessionId: string
  customerId: string
  areaKey: ScalpAnalysisAreaKey
  imageIndex: 1 | 2 | 3
  file: File
}

async function getStoredVisionSource(image: {
  storage_provider: string
  drive_file_id: string | null
  image_url: string
}): Promise<ScalpVisionImageSource> {
  if (image.storage_provider !== 'google-drive' || !image.drive_file_id) return {}
  const adapter = await getScalpStorageAdapter(image.storage_provider)
  if (!adapter.download) return {}
  return adapter.download(image.drive_file_id)
}

async function getAnalysisProvider() {
  const settings = await getAppSettings()
  if (settings.openAi.provider) return settings.openAi.provider
  return normalizeScalpAnalysisAiProvider(process.env.SCALP_ANALYSIS_AI_PROVIDER)
}

async function touchCustomer(customerId: string, now: string) {
  if (hasSupabaseServerEnv()) await touchCustomerInSupabase(customerId, now)
}

export async function createScalpSession(
  customerId: string,
  input?: { sessionDate?: string; notes?: string | null; staffName?: string | null },
) {
  const customer = await getCustomerRecord(customerId)
  if (!customer) throw new Error('customer_not_found: Customer not found for scalp analysis session.')
  await ensureScalpAnalysisCapturePoints()
  const sessionDate = input?.sessionDate ?? new Date().toISOString()
  const now = new Date().toISOString()
  const created = await createTrackingSessionRecord({
    customerId,
    checkDate: sessionDate,
    notes: input?.notes ?? null,
    staffName: input?.staffName ?? null,
    nowISO: now,
  })
  await touchCustomer(customerId, now)
  await recomputeCustomerTrackingSummaries(customerId)
  return created
}

export async function updateScalpSession(
  sessionId: string,
  input: { sessionDate: string; notes?: string | null },
) {
  const session = await getTrackingSession(sessionId)
  if (!session) throw new Error('session_not_found: Scalp analysis session not found.')
  const now = new Date().toISOString()
  const updated = await updateTrackingSessionRecord(sessionId, {
    checkDate: input.sessionDate,
    notes: input.notes ?? null,
    nowISO: now,
  })
  await touchCustomer(updated.customer_id, now)
  await recomputeCustomerTrackingSummaries(updated.customer_id)
  return updated
}

export async function analyzeScalpImage(
  imageUrl: string,
  source?: ScalpVisionImageSource,
): Promise<ScalpAnalysisAnnotations> {
  const provider = await getAnalysisProvider()
  if (provider === 'mock') return runMockAnalyzer(imageUrl)
  try {
    return await analyzeScalpImageWithOpenAi(imageUrl, source)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI Vision analysis failed'
    throw new Error(`ai_analysis_failed: ${message}`)
  }
}

function buildObjectKey(params: {
  customerId: string
  sessionId: string
  areaKey: ScalpAnalysisAreaKey
  imageIndex: 1 | 2 | 3
}) {
  return `${params.customerId}/${params.sessionId}/${params.areaKey}/${params.imageIndex}.jpg`
}

export async function uploadScalpImage(input: UploadInput) {
  const session = await getTrackingSession(input.sessionId)
  if (!session || session.customer_id !== input.customerId) {
    throw new Error('missing_image: Session not found for scalp analysis tracking.')
  }
  if (!isAreaKey(input.areaKey)) {
    throw new Error('invalid_area_key: Unsupported scalp analysis area key.')
  }

  const existing = await getTrackingImageBySlot(input.sessionId, input.areaKey, input.imageIndex)
  const adapter = await getScalpStorageAdapter()
  const objectKey = buildObjectKey({
    customerId: input.customerId,
    sessionId: input.sessionId,
    areaKey: input.areaKey,
    imageIndex: input.imageIndex,
  })
  const bytes = Buffer.from(await input.file.arrayBuffer())
  if (!isSupportedScalpImageBytes(bytes, input.file.type)) {
    throw new Error('invalid_image_content: Image content does not match its declared image type.')
  }
  const uploaded = await adapter.upload({
    objectKey,
    fileName: input.file.name || `shot-${input.imageIndex}.jpg`,
    contentType: input.file.type || 'image/jpeg',
    bytes,
  })

  const now = new Date().toISOString()
  let image = await commitUploadedStorageRecord({
    adapter,
    uploaded,
    rollbackOnWriteFailure: shouldRollbackUploadedStorageOnRecordFailure({
      hasExistingRecord: Boolean(existing),
      uploaded,
    }),
    writeRecord: () =>
      upsertTrackingImageRecord({
        customerId: input.customerId,
        sessionId: input.sessionId,
        areaKey: input.areaKey,
        imageIndex: input.imageIndex,
        imageUrl: uploaded.url,
        driveFileId: uploaded.fileId,
        storageProvider: uploaded.provider,
        storageObjectKey: uploaded.objectKey,
        analysisStatus: 'uploaded',
        nowISO: now,
      }),
  })

  if (!uploaded.publicAccess && uploaded.fileId) {
    image = await updateTrackingImageRecord(image.id, {
      image_url: `/api/scalp-analysis/images/${image.id}/file`,
      updated_at: now,
    })
  }

  if (existing?.drive_file_id || existing?.storage_object_key) {
    const previousAdapter = await getScalpStorageAdapter(existing.storage_provider)
    await deleteStorageBestEffort({
      adapter: previousAdapter,
      target: { fileId: existing.drive_file_id, objectKey: existing.storage_object_key },
      context: 'old overwritten image',
    })
  }

  try {
    const aiResult = await analyzeScalpImage(uploaded.url, {
      bytes,
      contentType: input.file.type || 'image/jpeg',
    })
    image = await updateTrackingImageRecord(image.id, {
      analysis_status: 'ai_ready',
      ai_result_json: aiResult,
      analysis_notes: aiResult.notes,
      updated_at: now,
    })
  } catch (error) {
    image = await updateTrackingImageRecord(image.id, {
      analysis_status: 'ai_failed',
      analysis_notes: error instanceof Error ? error.message : 'AI analysis failed',
      updated_at: now,
    })
  }

  // A changed earlier session can affect later comparisons for this area.
  await recomputeCustomerTrackingSummaries(input.customerId, input.areaKey)
  await touchCustomer(input.customerId, now)
  return image
}

export async function retryScalpImageAnalysis(imageId: string) {
  const image = await getTrackingImageById(imageId)
  if (!image) throw new Error('missing_image: Scalp analysis image not found.')
  if (image.analysis_status === 'confirmed') {
    throw new Error('ai_retry_not_allowed: Confirmed images should be edited through annotations.')
  }

  const now = new Date().toISOString()
  try {
    const aiResult = await analyzeScalpImage(image.image_url, await getStoredVisionSource(image))
    return updateTrackingImageRecord(imageId, {
      analysis_status: 'ai_ready',
      ai_result_json: aiResult,
      analysis_notes: aiResult.notes,
      updated_at: now,
    })
  } catch (error) {
    await updateTrackingImageRecord(imageId, {
      analysis_status: 'ai_failed',
      analysis_notes: error instanceof Error ? error.message : 'AI analysis failed',
      updated_at: now,
    })
    throw error
  }
}

export async function saveConfirmedAnnotations(imageId: string, annotationsJson: unknown) {
  const image = await getTrackingImageById(imageId)
  if (!image) throw new Error('missing_image: Scalp analysis image not found.')
  const annotations = normalizeAnnotations(annotationsJson)
  const now = new Date().toISOString()
  const updated = await updateTrackingImageRecord(imageId, {
    confirmed_annotations_json: annotations,
    analysis_status: 'confirmed',
    analysis_notes: annotations.notes,
    updated_at: now,
  })
  const stats = await calculateImageStats(imageId)
  await recomputeCustomerTrackingSummaries(updated.customer_id, updated.area_key)
  const summary = await getTrackingAreaSummary(updated.session_id, updated.area_key)
  await touchCustomer(updated.customer_id, now)
  return { image: stats, summary }
}

export async function calculateImageStats(imageId: string) {
  const image = await getTrackingImageById(imageId)
  if (!image) throw new Error('missing_image: Scalp analysis image not found.')
  if (!image.confirmed_annotations_json) {
    throw new Error('missing_image: Confirmed annotations are required before calculating image stats.')
  }
  const stats = calculateStatsFromAnnotations(image.confirmed_annotations_json)
  return updateTrackingImageRecord(imageId, {
    coarse_hair_count: stats.coarse_hair_count,
    baby_hair_count: stats.baby_hair_count,
    empty_follicle_count: stats.empty_follicle_count,
    blockage_count: stats.blockage_count,
    scalp_empty_ratio: stats.scalp_empty_ratio,
    redness_score: stats.redness_score,
    oiliness_score: stats.oiliness_score,
    density_score: stats.density_score,
    analysis_status: 'confirmed',
    updated_at: new Date().toISOString(),
  })
}

async function findReferenceSummary(params: {
  customerId: string
  sessionId: string
  areaKey: ScalpAnalysisAreaKey
  mode: 'previous' | 'baseline'
}) {
  const [sessions, summaries, currentSession] = await Promise.all([
    listTrackingSessions(params.customerId),
    listTrackingAreaSummariesForCustomer(params.customerId),
    getTrackingSession(params.sessionId),
  ])
  if (!currentSession) return null

  const ordered = [...sessions].sort(
    (a, b) =>
      a.check_date.localeCompare(b.check_date) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )
  const currentIndex = ordered.findIndex((session) => session.id === params.sessionId)
  if (currentIndex === -1) return null

  const priorSessions = ordered.slice(0, currentIndex)
  const referenceSession =
    params.mode === 'baseline'
      ? priorSessions.find((session) =>
          summaries.some((item) => item.session_id === session.id && item.area_key === params.areaKey),
        ) ?? null
      : priorSessions.at(-1) ?? null

  if (!referenceSession) return null
  const summary = summaries.find((item) => item.session_id === referenceSession.id && item.area_key === params.areaKey)
  return summary ? { session: referenceSession, summary } : null
}

export async function compareWithPreviousSession(customerId: string, sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  const current = await getTrackingAreaSummary(sessionId, areaKey)
  if (!current || !isTrustworthyCaptureConsistencyScore(current.capture_consistency_score)) return null
  const reference = await findReferenceSummary({ customerId, sessionId, areaKey, mode: 'previous' })
  if (!reference || !isTrustworthyCaptureConsistencyScore(reference.summary.capture_consistency_score)) return null
  return compareAreaSummaries({
    current,
    reference: reference.summary,
    referenceSessionId: reference.session.id,
    referenceSessionDate: reference.session.check_date,
  })
}

export async function compareWithBaseline(customerId: string, sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  const current = await getTrackingAreaSummary(sessionId, areaKey)
  if (!current || !isTrustworthyCaptureConsistencyScore(current.capture_consistency_score)) return null
  const reference = await findReferenceSummary({ customerId, sessionId, areaKey, mode: 'baseline' })
  if (!reference || !isTrustworthyCaptureConsistencyScore(reference.summary.capture_consistency_score)) return null
  return compareAreaSummaries({
    current,
    reference: reference.summary,
    referenceSessionId: reference.session.id,
    referenceSessionDate: reference.session.check_date,
  })
}

export async function calculateAreaSummary(sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  const session = await getTrackingSession(sessionId)
  if (!session) throw new Error('session_not_found: Scalp analysis session not found.')
  const images = (await listTrackingImagesForSession(sessionId)).filter((item) => item.area_key === areaKey)
  const confirmedImages = images.filter(
    isConfirmedScalpAnalysisImage,
  )

  if (confirmedImages.length < 3) {
    await deleteTrackingAreaSummary(sessionId, areaKey)
    return null
  }

  const averages = calculateAreaAverages(confirmedImages)
  const baseSummary = await upsertTrackingAreaSummary({
    customer_id: session.customer_id,
    session_id: sessionId,
    area_key: areaKey,
    ...averages,
    capture_consistency_score: calculateCaptureConsistencyScore(confirmedImages),
    compared_to_previous_json: null,
    compared_to_baseline_json: null,
    report_summary: null,
  })

  const [previous, baseline] = await Promise.all([
    compareWithPreviousSession(session.customer_id, sessionId, areaKey),
    compareWithBaseline(session.customer_id, sessionId, areaKey),
  ])

  return upsertTrackingAreaSummary({
    ...baseSummary,
    compared_to_previous_json: previous,
    compared_to_baseline_json: baseline,
    report_summary: buildAreaReportLine(SCALP_ANALYSIS_AREA_LABELS[areaKey], {
      ...baseSummary,
      compared_to_previous_json: previous,
      compared_to_baseline_json: baseline,
    }),
  })
}

async function recomputeCustomerTrackingSummaries(
  customerId: string,
  areaKey?: ScalpAnalysisAreaKey,
) {
  const [sessions, existingSummaries] = await Promise.all([
    listTrackingSessions(customerId),
    listTrackingAreaSummariesForCustomer(customerId),
  ])
  const imagesBySession = new Map(
    await Promise.all(
      sessions.map(async (session) => [
        session.id,
        (await listTrackingImagesForSession(session.id)).filter(
          (image) => !areaKey || image.area_key === areaKey,
        ),
      ] as const),
    ),
  )
  const targets = new Set(
    existingSummaries
      .filter((summary) => !areaKey || summary.area_key === areaKey)
      .map((summary) => `${summary.session_id}:${summary.area_key}`),
  )
  for (const [sessionId, images] of imagesBySession) {
    for (const image of images) targets.add(`${sessionId}:${image.area_key}`)
  }

  const sessionOrder = new Map(
    [...sessions]
      .sort(
        (a, b) =>
          a.check_date.localeCompare(b.check_date) ||
          a.created_at.localeCompare(b.created_at) ||
          a.id.localeCompare(b.id),
      )
      .map((session, index) => [session.id, index]),
  )
  const areaOrder = new Map(SCALP_ANALYSIS_AREA_KEYS.map((key, index) => [key, index]))
  const orderedTargets = [...targets].sort((a, b) => {
    const aSeparator = a.indexOf(':')
    const bSeparator = b.indexOf(':')
    const aSessionId = a.slice(0, aSeparator)
    const bSessionId = b.slice(0, bSeparator)
    const aArea = a.slice(aSeparator + 1) as ScalpAnalysisAreaKey
    const bArea = b.slice(bSeparator + 1) as ScalpAnalysisAreaKey
    return (
      (sessionOrder.get(aSessionId) ?? Number.MAX_SAFE_INTEGER) -
        (sessionOrder.get(bSessionId) ?? Number.MAX_SAFE_INTEGER) ||
      (areaOrder.get(aArea) ?? Number.MAX_SAFE_INTEGER) -
        (areaOrder.get(bArea) ?? Number.MAX_SAFE_INTEGER)
    )
  })

  for (const target of orderedTargets) {
    const separator = target.indexOf(':')
    if (separator === -1) continue
    await calculateAreaSummary(target.slice(0, separator), target.slice(separator + 1) as ScalpAnalysisAreaKey)
  }
}

export async function removeScalpImage(imageId: string) {
  const image = await getTrackingImageById(imageId)
  if (!image) throw new Error('missing_image: Scalp analysis image not found.')
  const adapter = await getScalpStorageAdapter(image.storage_provider)
  await deleteStorageRequired({
    adapter,
    target: { fileId: image.drive_file_id, objectKey: image.storage_object_key },
  })
  const deleted = await deleteTrackingImageRecord(imageId)
  await recomputeCustomerTrackingSummaries(deleted.customer_id, deleted.area_key)
  return deleted
}

export async function removeScalpSession(sessionId: string) {
  const session = await getTrackingSession(sessionId)
  if (!session) throw new Error('session_not_found: Scalp analysis session not found.')
  const images = await listTrackingImagesForSession(sessionId)
  const cleanupPlans = await Promise.all(
    images.map(async (image) => ({ image, adapter: await getScalpStorageAdapter(image.storage_provider) })),
  )
  await Promise.all(
    cleanupPlans.map(({ image, adapter }) =>
      deleteStorageRequired({
        adapter,
        target: { fileId: image.drive_file_id, objectKey: image.storage_object_key },
      }),
    ),
  )
  const deleted = await deleteTrackingSessionRecord(sessionId)
  await recomputeCustomerTrackingSummaries(deleted.customer_id)
  await touchCustomer(deleted.customer_id, new Date().toISOString())
  return deleted
}

export async function getScalpAnalysisSessionState(sessionId: string) {
  const state = await getTrackingSessionStateRecord(sessionId)
  if (!state) return null
  return {
    ...state,
    workflow_type: SCALP_ANALYSIS_WORKFLOW_TYPE,
  }
}

export async function getScalpAnalysisHistory(customerId: string) {
  if (!customerId) throw new Error('customer_id_required')
  const [sessions, summaries] = await Promise.all([
    listTrackingSessions(customerId),
    listTrackingAreaSummariesForCustomer(customerId),
  ])
  return buildScalpAnalysisHistory(sessions, summaries)
}

export function toScalpAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown scalp analysis error'
  const lowered = message.toLowerCase()
  if (lowered.includes('google drive auth failed')) return 'google_drive_auth_failed'
  if (
    lowered.includes('google drive upload failed') ||
    lowered.includes('google drive download failed') ||
    lowered.includes('permission failed')
  ) return 'upload_failed'
  if (lowered.includes('ai_analysis_failed')) return 'ai_analysis_failed'
  if (lowered.includes('customer_not_found')) return 'customer_not_found'
  if (lowered.includes('session_not_found')) return 'session_not_found'
  if (
    lowered.includes('storage_cleanup_failed') ||
    lowered.includes('google drive delete failed')
  ) return 'storage_cleanup_failed'
  if (lowered.includes('missing_image')) return message.split(':')[0]
  if (lowered.includes('invalid_area_key')) return 'invalid_area_key'
  if (lowered.includes('invalid_image_content')) return 'invalid_image_content'
  if (lowered.includes('annotations_required')) return 'annotations_required'
  if (lowered.includes('ai_retry_not_allowed')) return 'ai_retry_not_allowed'
  if (lowered.includes('supabase_env_missing')) return 'supabase_env_missing'
  const explainedSupabaseError = explainSupabaseErrorMessage(message)
  const supabaseCode = explainedSupabaseError.split(':', 1)[0]
  if (
    supabaseCode === 'supabase_env_missing' ||
    supabaseCode === 'supabase_connection_failed' ||
    supabaseCode === 'supabase_schema_missing' ||
    supabaseCode === 'supabase_storage_error'
  ) {
    return supabaseCode
  }
  return `scalp_analysis_error: ${message}`
}

export function scalpAnalysisErrorStatus(error: unknown) {
  const code = toScalpAnalysisError(error)
  if (code === 'customer_not_found' || code === 'session_not_found' || code === 'missing_image') return 404
  if (
    code === 'invalid_area_key' ||
    code === 'invalid_image_content' ||
    code === 'annotations_required' ||
    code === 'ai_retry_not_allowed'
  ) return 400
  if (
    code === 'supabase_env_missing' ||
    code === 'supabase_connection_failed' ||
    code === 'supabase_schema_missing' ||
    code === 'supabase_storage_error'
  ) return 503
  return 500
}
