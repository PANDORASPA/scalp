import 'server-only'

import { normalizeScalpAnalysisAiProvider } from '@/lib/config/scalp-analysis-ai'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { getAppSettings } from '@/lib/settings/repository'
import { touchCustomerInSupabase } from '@/lib/supabase/repository'

import { SCALP_ANALYSIS_AREA_LABELS, SCALP_ANALYSIS_WORKFLOW_TYPE, type ScalpAnalysisAreaKey } from './constants'
import { analyzeScalpImage as runMockAnalyzer } from './mock-analyzer'
import { analyzeScalpImageWithOpenAi } from './openai-vision'
import {
  buildAreaReportLine,
  calculateAreaAverages,
  calculateStatsFromAnnotations,
  compareAreaSummaries,
  isAreaKey,
  normalizeAnnotations,
} from './logic'
import {
  createTrackingSessionRecord,
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
} from './repository'
import { getScalpStorageAdapter } from './storage'
import { commitUploadedStorageRecord, deleteStorageBestEffort } from './storage-consistency'
import type { ScalpAnalysisAnnotations } from './types'

type UploadInput = {
  sessionId: string
  customerId: string
  areaKey: ScalpAnalysisAreaKey
  imageIndex: 1 | 2 | 3
  file: File
}

async function getAnalysisProvider() {
  const settings = await getAppSettings()
  if (settings.openAi.provider) return settings.openAi.provider
  return normalizeScalpAnalysisAiProvider(process.env.SCALP_ANALYSIS_AI_PROVIDER)
}

export async function createScalpSession(customerId: string, input?: { sessionDate?: string; notes?: string | null }) {
  if (!hasSupabaseServerEnv()) {
    throw new Error('supabase_env_missing: Scalp analysis tracking requires Supabase server env.')
  }
  await ensureScalpAnalysisCapturePoints()
  const sessionDate = input?.sessionDate ?? new Date().toISOString()
  const now = new Date().toISOString()
  const created = await createTrackingSessionRecord({
    customerId,
    checkDate: sessionDate,
    notes: input?.notes ?? null,
    nowISO: now,
  })
  await touchCustomerInSupabase(customerId, now)
  return created
}

export async function analyzeScalpImage(imageUrl: string): Promise<ScalpAnalysisAnnotations> {
  const provider = await getAnalysisProvider()
  if (provider === 'mock') return runMockAnalyzer(imageUrl)
  try {
    return await analyzeScalpImageWithOpenAi(imageUrl)
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
  if (!hasSupabaseServerEnv()) {
    throw new Error('supabase_env_missing: Scalp analysis tracking requires Supabase server env.')
  }
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

  if (existing?.drive_file_id || existing?.storage_object_key) {
    await deleteStorageBestEffort({
      adapter,
      target: { fileId: existing.drive_file_id, objectKey: existing.storage_object_key },
      context: 'old overwritten image',
    })
  }

  try {
    const aiResult = await analyzeScalpImage(uploaded.url)
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

  await calculateAreaSummary(input.sessionId, input.areaKey)
  await touchCustomerInSupabase(input.customerId, now)
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
    const aiResult = await analyzeScalpImage(image.image_url)
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
  const summary = await calculateAreaSummary(updated.session_id, updated.area_key)
  await touchCustomerInSupabase(updated.customer_id, now)
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

  const ordered = [...sessions].sort((a, b) => a.check_date.localeCompare(b.check_date))
  const currentIndex = ordered.findIndex((session) => session.id === params.sessionId)
  if (currentIndex === -1) return null

  const referenceSession =
    params.mode === 'baseline'
      ? ordered[0] ?? null
      : currentIndex > 0
        ? ordered[currentIndex - 1]
        : null

  if (!referenceSession || referenceSession.id === params.sessionId) return null
  const summary = summaries.find(
    (item) => item.session_id === referenceSession.id && item.area_key === params.areaKey,
  )
  return summary ? { session: referenceSession, summary } : null
}

export async function compareWithPreviousSession(customerId: string, sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  const current = await getTrackingAreaSummary(sessionId, areaKey)
  if (!current) return null
  const reference = await findReferenceSummary({ customerId, sessionId, areaKey, mode: 'previous' })
  if (!reference) return null
  return compareAreaSummaries({
    current,
    reference: reference.summary,
    referenceSessionId: reference.session.id,
    referenceSessionDate: reference.session.check_date,
  })
}

export async function compareWithBaseline(customerId: string, sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  const current = await getTrackingAreaSummary(sessionId, areaKey)
  if (!current) return null
  const reference = await findReferenceSummary({ customerId, sessionId, areaKey, mode: 'baseline' })
  if (!reference) return null
  return compareAreaSummaries({
    current,
    reference: reference.summary,
    referenceSessionId: reference.session.id,
    referenceSessionDate: reference.session.check_date,
  })
}

export async function calculateAreaSummary(sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  const session = await getTrackingSession(sessionId)
  if (!session) throw new Error('missing_image: Scalp analysis session not found.')
  const images = (await listTrackingImagesForSession(sessionId)).filter((item) => item.area_key === areaKey)
  const confirmedImages = images.filter(
    (item) =>
      item.analysis_status === 'confirmed' &&
      item.confirmed_annotations_json &&
      typeof item.stats.coarse_hair_count === 'number',
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

export async function removeScalpImage(imageId: string) {
  const image = await getTrackingImageById(imageId)
  if (!image) throw new Error('missing_image: Scalp analysis image not found.')
  const adapter = await getScalpStorageAdapter()
  const deleted = await deleteTrackingImageRecord(imageId)
  await deleteStorageBestEffort({
    adapter,
    target: { fileId: image.drive_file_id, objectKey: image.storage_object_key },
    context: 'deleted image',
  })
  await calculateAreaSummary(deleted.session_id, deleted.area_key).catch(async () => {
    await deleteTrackingAreaSummary(deleted.session_id, deleted.area_key)
  })
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

export function toScalpAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown scalp analysis error'
  const lowered = message.toLowerCase()
  if (lowered.includes('google drive auth failed')) return 'google_drive_auth_failed'
  if (lowered.includes('google drive upload failed') || lowered.includes('permission failed')) return 'upload_failed'
  if (lowered.includes('ai_analysis_failed')) return 'ai_analysis_failed'
  if (lowered.includes('missing_image')) return message.split(':')[0]
  if (lowered.includes('supabase_env_missing')) return 'supabase_env_missing'
  return `scalp_analysis_error: ${message}`
}
