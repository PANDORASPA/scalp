import { randomUUID } from 'node:crypto'

import { SCALP_ANALYSIS_AREA_KEYS, SCALP_ANALYSIS_AREA_LABELS, SCALP_ANALYSIS_WORKFLOW_TYPE, type ScalpAnalysisAreaKey } from './constants'
import { isConfirmedScalpAnalysisImage, normalizeAnnotations } from './logic'
import { readDb, updateDb } from '../mockdb/store'
import type { Customer, ScalpSession } from '../scalp/types'
import type { ScalpAnalysisImage, ScalpAnalysisSessionState, ScalpAreaSummary } from './types'

type TrackingImageInput = {
  customerId: string
  sessionId: string
  areaKey: ScalpAnalysisAreaKey
  imageIndex: 1 | 2 | 3
  imageUrl: string
  driveFileId: string | null
  storageProvider: string
  storageObjectKey: string | null
  analysisStatus: ScalpAnalysisImage['analysis_status']
  aiResultJson?: unknown
  confirmedAnnotationsJson?: unknown
  nowISO: string
}

type TrackingImagePatch = Partial<{
  image_url: string
  drive_file_id: string | null
  storage_provider: string
  storage_object_key: string | null
  analysis_status: ScalpAnalysisImage['analysis_status']
  ai_result_json: unknown
  confirmed_annotations_json: unknown
  analysis_notes: string | null
  coarse_hair_count: number | null
  baby_hair_count: number | null
  empty_follicle_count: number | null
  blockage_count: number | null
  scalp_empty_ratio: number | null
  redness_score: number | null
  oiliness_score: number | null
  density_score: number | null
  updated_at: string
}>

function isTrackingSession(session: ScalpSession) {
  return session.workflow_type === SCALP_ANALYSIS_WORKFLOW_TYPE
}

function emptyStats(): ScalpAnalysisImage['stats'] {
  return {
    coarse_hair_count: null,
    baby_hair_count: null,
    empty_follicle_count: null,
    blockage_count: null,
    scalp_empty_ratio: null,
    redness_score: null,
    oiliness_score: null,
    density_score: null,
  }
}

function getTrackingImages(db: Awaited<ReturnType<typeof readDb>>) {
  return db.trackingImages ?? []
}

function getTrackingAreaSummaries(db: Awaited<ReturnType<typeof readDb>>) {
  return db.trackingAreaSummaries ?? []
}

export async function ensureScalpAnalysisCapturePoints() {
  return
}

export async function createTrackingSessionRecord(input: {
  customerId: string
  checkDate: string
  notes: string | null
  staffName?: string | null
  nowISO: string
}) {
  const session: ScalpSession = {
    id: randomUUID(),
    customer_id: input.customerId,
    check_date: input.checkDate,
    staff_name: input.staffName ?? null,
    notes: input.notes,
    workflow_type: SCALP_ANALYSIS_WORKFLOW_TYPE,
    created_at: input.nowISO,
    updated_at: input.nowISO,
  }
  return updateDb((db) => ({ db: { ...db, sessions: [...db.sessions, session] }, result: session }))
}

export async function listTrackingSessions(customerId: string) {
  const db = await readDb()
  return db.sessions
    .filter((session) => session.customer_id === customerId && isTrackingSession(session))
    .sort((a, b) => b.check_date.localeCompare(a.check_date) || b.created_at.localeCompare(a.created_at))
}

export async function getTrackingSession(sessionId: string) {
  const db = await readDb()
  return db.sessions.find((session) => session.id === sessionId && isTrackingSession(session)) ?? null
}

export async function updateTrackingSessionRecord(
  sessionId: string,
  input: { checkDate: string; notes: string | null; nowISO: string },
) {
  return updateDb((db) => {
    const current = db.sessions.find((session) => session.id === sessionId && isTrackingSession(session))
    if (!current) throw new Error('update scalp analysis session: session not found')
    const updated = { ...current, check_date: input.checkDate, notes: input.notes, updated_at: input.nowISO }
    return {
      db: { ...db, sessions: db.sessions.map((session) => (session.id === sessionId ? updated : session)) },
      result: updated,
    }
  })
}

export async function deleteTrackingSessionRecord(sessionId: string) {
  return updateDb((db) => {
    const deleted = db.sessions.find((session) => session.id === sessionId && isTrackingSession(session))
    if (!deleted) throw new Error('delete scalp analysis session: session not found')
    return {
      db: {
        ...db,
        sessions: db.sessions.filter((session) => session.id !== sessionId),
        trackingImages: getTrackingImages(db).filter((image) => image.session_id !== sessionId),
        trackingAreaSummaries: getTrackingAreaSummaries(db).filter((summary) => summary.session_id !== sessionId),
      },
      result: deleted,
    }
  })
}

export async function getCustomerRecord(customerId: string) {
  const db = await readDb()
  return db.customers.find((customer) => customer.id === customerId) ?? null
}

export async function upsertTrackingImageRecord(input: TrackingImageInput) {
  return updateDb((db) => {
    const session = db.sessions.find((item) => item.id === input.sessionId)
    if (!session || !isTrackingSession(session) || session.customer_id !== input.customerId) {
      throw new Error('session_not_found: Tracking image session does not belong to customer.')
    }

    const existing = getTrackingImages(db).find(
      (image) => image.session_id === input.sessionId && image.area_key === input.areaKey && image.image_index === input.imageIndex,
    )
    const image: ScalpAnalysisImage = {
      id: existing?.id ?? randomUUID(),
      customer_id: input.customerId,
      session_id: input.sessionId,
      area_key: input.areaKey,
      image_index: input.imageIndex,
      image_url: input.imageUrl,
      drive_file_id: input.driveFileId,
      storage_provider: input.storageProvider,
      storage_object_key: input.storageObjectKey,
      analysis_status: input.analysisStatus,
      ai_result_json: input.aiResultJson ? normalizeAnnotations(input.aiResultJson) : null,
      confirmed_annotations_json: input.confirmedAnnotationsJson ? normalizeAnnotations(input.confirmedAnnotationsJson) : null,
      stats: emptyStats(),
      created_at: existing?.created_at ?? input.nowISO,
      updated_at: input.nowISO,
    }
    const nextImages = existing
      ? getTrackingImages(db).map((item) => (item.id === existing.id ? image : item))
      : [...getTrackingImages(db), image]
    return { db: { ...db, trackingImages: nextImages }, result: image }
  })
}

export async function updateTrackingImageRecord(imageId: string, patch: TrackingImagePatch) {
  return updateDb((db) => {
    const current = getTrackingImages(db).find((image) => image.id === imageId)
    const session = current ? db.sessions.find((item) => item.id === current.session_id) : null
    if (!current || !session || !isTrackingSession(session) || session.customer_id !== current.customer_id) {
      throw new Error('update scalp analysis image: image not found')
    }
    const updated: ScalpAnalysisImage = {
      ...current,
      ...(patch.image_url === undefined ? {} : { image_url: patch.image_url }),
      ...(patch.drive_file_id === undefined ? {} : { drive_file_id: patch.drive_file_id }),
      ...(patch.storage_provider === undefined ? {} : { storage_provider: patch.storage_provider }),
      ...(patch.storage_object_key === undefined ? {} : { storage_object_key: patch.storage_object_key }),
      ...(patch.analysis_status === undefined ? {} : { analysis_status: patch.analysis_status }),
      ...(patch.ai_result_json === undefined ? {} : { ai_result_json: patch.ai_result_json ? normalizeAnnotations(patch.ai_result_json) : null }),
      ...(patch.confirmed_annotations_json === undefined ? {} : { confirmed_annotations_json: patch.confirmed_annotations_json ? normalizeAnnotations(patch.confirmed_annotations_json) : null }),
      ...(patch.analysis_notes === undefined ? {} : { analysis_notes: patch.analysis_notes }),
      stats: {
        coarse_hair_count: patch.coarse_hair_count === undefined ? current.stats.coarse_hair_count : patch.coarse_hair_count,
        baby_hair_count: patch.baby_hair_count === undefined ? current.stats.baby_hair_count : patch.baby_hair_count,
        empty_follicle_count: patch.empty_follicle_count === undefined ? current.stats.empty_follicle_count : patch.empty_follicle_count,
        blockage_count: patch.blockage_count === undefined ? current.stats.blockage_count : patch.blockage_count,
        scalp_empty_ratio: patch.scalp_empty_ratio === undefined ? current.stats.scalp_empty_ratio : patch.scalp_empty_ratio,
        redness_score: patch.redness_score === undefined ? current.stats.redness_score : patch.redness_score,
        oiliness_score: patch.oiliness_score === undefined ? current.stats.oiliness_score : patch.oiliness_score,
        density_score: patch.density_score === undefined ? current.stats.density_score : patch.density_score,
      },
      updated_at: patch.updated_at ?? new Date().toISOString(),
    }
    return {
      db: { ...db, trackingImages: getTrackingImages(db).map((image) => (image.id === imageId ? updated : image)) },
      result: updated,
    }
  })
}

export async function getTrackingImageById(imageId: string) {
  const db = await readDb()
  const image = getTrackingImages(db).find((item) => item.id === imageId)
  if (!image) return null
  const session = db.sessions.find((item) => item.id === image.session_id)
  if (!session || !isTrackingSession(session) || session.customer_id !== image.customer_id) return null
  return image
}

export async function getTrackingImageBySlot(sessionId: string, areaKey: ScalpAnalysisAreaKey, imageIndex: 1 | 2 | 3) {
  const db = await readDb()
  const session = db.sessions.find((item) => item.id === sessionId)
  if (!session || !isTrackingSession(session)) return null
  return getTrackingImages(db).find(
    (image) => image.session_id === sessionId && image.area_key === areaKey && image.image_index === imageIndex,
  ) ?? null
}

export async function deleteTrackingImageRecord(imageId: string) {
  return updateDb((db) => {
    const deleted = getTrackingImages(db).find((image) => image.id === imageId)
    const session = deleted ? db.sessions.find((item) => item.id === deleted.session_id) : null
    if (!deleted || !session || !isTrackingSession(session) || session.customer_id !== deleted.customer_id) {
      throw new Error('delete scalp analysis image: image not found')
    }
    return {
      db: { ...db, trackingImages: getTrackingImages(db).filter((image) => image.id !== imageId) },
      result: deleted,
    }
  })
}

export async function listTrackingImagesForSession(sessionId: string) {
  const db = await readDb()
  const session = db.sessions.find((item) => item.id === sessionId)
  if (!session || !isTrackingSession(session)) return []
  return getTrackingImages(db)
    .filter((image) => image.session_id === sessionId && SCALP_ANALYSIS_AREA_KEYS.includes(image.area_key))
    .sort((a, b) => a.area_key.localeCompare(b.area_key) || a.image_index - b.image_index)
}

export async function listTrackingAreaSummariesForCustomer(customerId: string) {
  const db = await readDb()
  return getTrackingAreaSummaries(db).filter((summary) => summary.customer_id === customerId)
}

export async function upsertTrackingAreaSummary(input: Omit<ScalpAreaSummary, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
  return updateDb((db) => {
    const session = db.sessions.find((item) => item.id === input.session_id)
    if (!session || !isTrackingSession(session) || session.customer_id !== input.customer_id) {
      throw new Error('session_not_found: Tracking summary session does not belong to customer.')
    }

    const existing = getTrackingAreaSummaries(db).find(
      (summary) => summary.session_id === input.session_id && summary.area_key === input.area_key,
    )
    const summary: ScalpAreaSummary = {
      ...input,
      id: input.id ?? existing?.id ?? randomUUID(),
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const nextSummaries = existing
      ? getTrackingAreaSummaries(db).map((item) => (item.id === existing.id ? summary : item))
      : [...getTrackingAreaSummaries(db), summary]
    return { db: { ...db, trackingAreaSummaries: nextSummaries }, result: summary }
  })
}

export async function deleteTrackingAreaSummary(sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  await updateDb((db) => ({
    db: {
      ...db,
      trackingAreaSummaries: db.sessions.some((item) => item.id === sessionId && isTrackingSession(item))
        ? getTrackingAreaSummaries(db).filter((summary) => !(summary.session_id === sessionId && summary.area_key === areaKey))
        : getTrackingAreaSummaries(db),
    },
    result: undefined,
  }))
}

export async function getTrackingAreaSummary(sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  const db = await readDb()
  const session = db.sessions.find((item) => item.id === sessionId)
  if (!session || !isTrackingSession(session)) return null
  return getTrackingAreaSummaries(db).find((summary) => summary.session_id === sessionId && summary.area_key === areaKey) ?? null
}

export async function getTrackingSessionStateRecord(sessionId: string): Promise<ScalpAnalysisSessionState | null> {
  const db = await readDb()
  const session = db.sessions.find((item) => item.id === sessionId && isTrackingSession(item))
  if (!session) return null
  const customer = db.customers.find((item) => item.id === session.customer_id) as Customer | undefined
  const images = getTrackingImages(db).filter((image) => image.session_id === sessionId)
  const summaries = getTrackingAreaSummaries(db).filter((summary) => summary.session_id === sessionId)
  const areas = SCALP_ANALYSIS_AREA_KEYS.map((areaKey) => {
    const areaImages = images.filter((image) => image.area_key === areaKey)
    const confirmedImages = areaImages.filter(isConfirmedScalpAnalysisImage)
    return {
      area_key: areaKey,
      label: SCALP_ANALYSIS_AREA_LABELS[areaKey],
      images: areaImages,
      summary: summaries.find((summary) => summary.area_key === areaKey) ?? null,
      uploaded_images: areaImages.length,
      confirmed_images: confirmedImages.length,
      pending_confirmation_images: areaImages.filter((image) => !isConfirmedScalpAnalysisImage(image)).length,
      missing_images: Math.max(0, 3 - areaImages.length),
      ready_for_average: areaImages.length === 3 && areaImages.every(isConfirmedScalpAnalysisImage),
    }
  })
  const readyAreas = areas.filter((area) => area.ready_for_average).length
  const allImages = areas.flatMap((area) => area.images)
  return {
    session,
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    areas,
    progress: {
      total_images: SCALP_ANALYSIS_AREA_KEYS.length * 3,
      uploaded_images: areas.reduce((total, area) => total + area.uploaded_images, 0),
      confirmed_images: areas.reduce((total, area) => total + area.confirmed_images, 0),
      total_areas: SCALP_ANALYSIS_AREA_KEYS.length,
      ready_areas: readyAreas,
      pending_confirmation_areas: areas.filter((area) => area.uploaded_images > 0 && !area.ready_for_average).length,
      ai_retryable_images: allImages.filter(
        (image) => image.analysis_status === 'uploaded' || image.analysis_status === 'ai_failed',
      ).length,
      ai_failed_images: allImages.filter((image) => image.analysis_status === 'ai_failed').length,
    },
    report_lines: summaries.map((summary) => summary.report_summary).filter((value): value is string => Boolean(value)),
  }
}
