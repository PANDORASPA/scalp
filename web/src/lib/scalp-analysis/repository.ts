import 'server-only'

import { SCALP_ANALYSIS_AREA_KEYS, SCALP_ANALYSIS_AREA_LABELS, type ScalpAnalysisAreaKey } from '@/lib/scalp-analysis/constants'
import type { Customer, ScalpSession } from '@/lib/scalp/types'
import { getSupabaseAdminClient } from '@/lib/supabase/client'
import { shouldUseSupabaseDataSource } from '@/lib/config/supabase'

import { isConfirmedScalpAnalysisImage, normalizeAnnotations } from './logic'
import type { ScalpAnalysisImage, ScalpAreaSummary, ScalpAnalysisSessionState, ScalpSessionComparison } from './types'
import * as mockRepository from './mock-repository'

const shouldUseMockRepository = () => !shouldUseSupabaseDataSource()

type CapturePointRow = {
  id: string
  code: string
  display_name: string | null
  sort_order: number
}

type ScalpImageTrackingRow = {
  id: string
  customer_id: string
  session_id: string
  capture_point_id: string
  shot_index: number
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
  created_at: string
  updated_at: string
}

type ScalpAreaSummaryRow = {
  id: string
  customer_id: string
  session_id: string
  capture_point_id: string
  average_coarse_hair_count: number | null
  average_baby_hair_count: number | null
  average_empty_follicle_count: number | null
  average_blockage_count: number | null
  average_scalp_empty_ratio: number | null
  average_redness_score: number | null
  average_oiliness_score: number | null
  average_density_score: number | null
  capture_consistency_score: number | null
  compared_to_previous_json: ScalpSessionComparison | null
  compared_to_baseline_json: ScalpSessionComparison | null
  report_summary: string | null
  created_at: string
  updated_at: string
}

async function getCapturePointMaps() {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_capture_points')
    .select('id, code, display_name, sort_order')
    .in('code', [...SCALP_ANALYSIS_AREA_KEYS])
  if (error) throw new Error(`scalp_capture_points: ${error.message}`)
  const rows = (data ?? []) as CapturePointRow[]
  const byCode = new Map(rows.map((row) => [row.code, row.id]))
  const byId = new Map(rows.map((row) => [row.id, row.code]))
  return { byCode, byId }
}

function toAreaKey(code: string): ScalpAnalysisAreaKey {
  return code as ScalpAnalysisAreaKey
}

function mapImage(row: ScalpImageTrackingRow, byId: Map<string, string>): ScalpAnalysisImage {
  const code = byId.get(row.capture_point_id)
  if (!code) throw new Error(`Unknown capture point id: ${row.capture_point_id}`)
  return {
    id: row.id,
    customer_id: row.customer_id,
    session_id: row.session_id,
    area_key: toAreaKey(code),
    image_index: row.shot_index as 1 | 2 | 3,
    image_url: row.image_url,
    drive_file_id: row.drive_file_id,
    storage_provider: row.storage_provider,
    storage_object_key: row.storage_object_key,
    analysis_status: row.analysis_status,
    ai_result_json: row.ai_result_json ? normalizeAnnotations(row.ai_result_json) : null,
    confirmed_annotations_json: row.confirmed_annotations_json ? normalizeAnnotations(row.confirmed_annotations_json) : null,
    analysis_notes: row.analysis_notes,
    stats: {
      coarse_hair_count: row.coarse_hair_count,
      baby_hair_count: row.baby_hair_count,
      empty_follicle_count: row.empty_follicle_count,
      blockage_count: row.blockage_count,
      scalp_empty_ratio: row.scalp_empty_ratio,
      redness_score: row.redness_score,
      oiliness_score: row.oiliness_score,
      density_score: row.density_score,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapSummary(row: ScalpAreaSummaryRow, byId: Map<string, string>): ScalpAreaSummary {
  const code = byId.get(row.capture_point_id)
  if (!code) throw new Error(`Unknown capture point id: ${row.capture_point_id}`)
  return {
    id: row.id,
    customer_id: row.customer_id,
    session_id: row.session_id,
    area_key: toAreaKey(code),
    average_coarse_hair_count: row.average_coarse_hair_count,
    average_baby_hair_count: row.average_baby_hair_count,
    average_empty_follicle_count: row.average_empty_follicle_count,
    average_blockage_count: row.average_blockage_count,
    average_scalp_empty_ratio: row.average_scalp_empty_ratio,
    average_redness_score: row.average_redness_score,
    average_oiliness_score: row.average_oiliness_score,
    average_density_score: row.average_density_score,
    capture_consistency_score: row.capture_consistency_score ?? null,
    compared_to_previous_json: row.compared_to_previous_json,
    compared_to_baseline_json: row.compared_to_baseline_json,
    report_summary: row.report_summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function ensureScalpAnalysisCapturePoints() {
  if (shouldUseMockRepository()) return mockRepository.ensureScalpAnalysisCapturePoints()
  const client = getSupabaseAdminClient()
  const { error } = await client.from('scalp_capture_points').upsert(
    SCALP_ANALYSIS_AREA_KEYS.map((code, index) => ({
      code,
      display_name: SCALP_ANALYSIS_AREA_LABELS[code],
      sort_order: 101 + index,
    })),
    { onConflict: 'code' },
  )
  if (error) throw new Error(`seed scalp analysis capture points: ${error.message}`)
}

export async function createTrackingSessionRecord(input: {
  customerId: string
  checkDate: string
  notes: string | null
  staffName?: string | null
  nowISO: string
}) {
  if (shouldUseMockRepository()) return mockRepository.createTrackingSessionRecord(input)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_sessions')
    .insert({
      customer_id: input.customerId,
      check_date: input.checkDate,
      staff_name: input.staffName ?? null,
      notes: input.notes,
      workflow_type: 'scalp_analysis_tracking',
      created_at: input.nowISO,
      updated_at: input.nowISO,
    })
    .select('*')
    .single()
  if (error) throw new Error(`create scalp analysis session: ${error.message}`)
  return data as ScalpSession
}

export async function listTrackingSessions(customerId: string) {
  if (shouldUseMockRepository()) return mockRepository.listTrackingSessions(customerId)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_sessions')
    .select('*')
    .eq('customer_id', customerId)
    .eq('workflow_type', 'scalp_analysis_tracking')
    .order('check_date', { ascending: false })
  if (error) throw new Error(`list scalp analysis sessions: ${error.message}`)
  return (data ?? []) as ScalpSession[]
}

export async function getTrackingSession(sessionId: string) {
  if (shouldUseMockRepository()) return mockRepository.getTrackingSession(sessionId)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('workflow_type', 'scalp_analysis_tracking')
    .maybeSingle()
  if (error) throw new Error(`get scalp analysis session: ${error.message}`)
  return (data as ScalpSession | null) ?? null
}

export async function updateTrackingSessionRecord(
  sessionId: string,
  input: { checkDate: string; notes: string | null; nowISO: string },
) {
  if (shouldUseMockRepository()) return mockRepository.updateTrackingSessionRecord(sessionId, input)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_sessions')
    .update({
      check_date: input.checkDate,
      notes: input.notes,
      updated_at: input.nowISO,
    })
    .eq('id', sessionId)
    .eq('workflow_type', 'scalp_analysis_tracking')
    .select('*')
    .single()
  if (error) throw new Error(`update scalp analysis session: ${error.message}`)
  return data as ScalpSession
}

export async function deleteTrackingSessionRecord(sessionId: string) {
  if (shouldUseMockRepository()) return mockRepository.deleteTrackingSessionRecord(sessionId)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('workflow_type', 'scalp_analysis_tracking')
    .select('*')
    .single()
  if (error) throw new Error(`delete scalp analysis session: ${error.message}`)
  return data as ScalpSession
}

export async function getCustomerRecord(customerId: string) {
  if (shouldUseMockRepository()) return mockRepository.getCustomerRecord(customerId)
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('customers').select('*').eq('id', customerId).maybeSingle()
  if (error) throw new Error(`get customer: ${error.message}`)
  return (data as Customer | null) ?? null
}

export async function upsertTrackingImageRecord(input: {
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
}) {
  if (shouldUseMockRepository()) return mockRepository.upsertTrackingImageRecord(input)
  const session = await getTrackingSession(input.sessionId)
  if (!session || session.customer_id !== input.customerId) {
    throw new Error('session_not_found: Tracking image session does not belong to customer.')
  }
  const { byCode, byId } = await getCapturePointMaps()
  const capturePointId = byCode.get(input.areaKey)
  if (!capturePointId) throw new Error(`Unknown area key: ${input.areaKey}`)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_images')
    .upsert(
      {
        customer_id: input.customerId,
        session_id: input.sessionId,
        capture_point_id: capturePointId,
        shot_index: input.imageIndex,
        image_type: 'micro',
        image_url: input.imageUrl,
        drive_file_id: input.driveFileId,
        storage_provider: input.storageProvider,
        storage_object_key: input.storageObjectKey,
        analysis_status: input.analysisStatus,
        ai_result_json: input.aiResultJson ?? null,
        confirmed_annotations_json: input.confirmedAnnotationsJson ?? null,
        coarse_hair_count: null,
        baby_hair_count: null,
        empty_follicle_count: null,
        blockage_count: null,
        scalp_empty_ratio: null,
        redness_score: null,
        oiliness_score: null,
        density_score: null,
        analysis_notes: null,
        updated_at: input.nowISO,
      },
      { onConflict: 'session_id,capture_point_id,shot_index' },
    )
    .select('*')
    .single()
  if (error) throw new Error(`upsert scalp analysis image: ${error.message}`)
  return mapImage(data as ScalpImageTrackingRow, byId)
}

export async function updateTrackingImageRecord(
  imageId: string,
  patch: Partial<{
    image_url: string
    drive_file_id: string | null
    storage_provider: string
    storage_object_key: string | null
    analysis_status: ScalpAnalysisImage['analysis_status']
    ai_result_json: unknown
    confirmed_annotations_json: unknown
    coarse_hair_count: number | null
    baby_hair_count: number | null
    empty_follicle_count: number | null
    blockage_count: number | null
    scalp_empty_ratio: number | null
    redness_score: number | null
    oiliness_score: number | null
    density_score: number | null
    analysis_notes: string | null
    updated_at: string
  }>,
) {
  if (shouldUseMockRepository()) return mockRepository.updateTrackingImageRecord(imageId, patch)
  if (!await getTrackingImageById(imageId)) {
    throw new Error('update scalp analysis image: image not found')
  }
  const { byId } = await getCapturePointMaps()
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('scalp_images').update(patch).eq('id', imageId).select('*').single()
  if (error) throw new Error(`update scalp analysis image: ${error.message}`)
  return mapImage(data as ScalpImageTrackingRow, byId)
}

export async function getTrackingImageById(imageId: string) {
  if (shouldUseMockRepository()) return mockRepository.getTrackingImageById(imageId)
  const { byId } = await getCapturePointMaps()
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('scalp_images').select('*').eq('id', imageId).maybeSingle()
  if (error) throw new Error(`get scalp analysis image: ${error.message}`)
  if (!data) return null
  const image = mapImage(data as ScalpImageTrackingRow, byId)
  const session = await getTrackingSession(image.session_id)
  if (!session || session.customer_id !== image.customer_id) return null
  return image
}

export async function getTrackingImageBySlot(sessionId: string, areaKey: ScalpAnalysisAreaKey, imageIndex: 1 | 2 | 3) {
  if (shouldUseMockRepository()) return mockRepository.getTrackingImageBySlot(sessionId, areaKey, imageIndex)
  if (!await getTrackingSession(sessionId)) return null
  const { byCode, byId } = await getCapturePointMaps()
  const capturePointId = byCode.get(areaKey)
  if (!capturePointId) throw new Error(`Unknown area key: ${areaKey}`)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_images')
    .select('*')
    .eq('session_id', sessionId)
    .eq('capture_point_id', capturePointId)
    .eq('shot_index', imageIndex)
    .maybeSingle()
  if (error) throw new Error(`get scalp analysis image slot: ${error.message}`)
  return data ? mapImage(data as ScalpImageTrackingRow, byId) : null
}

export async function deleteTrackingImageRecord(imageId: string) {
  if (shouldUseMockRepository()) return mockRepository.deleteTrackingImageRecord(imageId)
  if (!await getTrackingImageById(imageId)) {
    throw new Error('delete scalp analysis image: image not found')
  }
  const { byId } = await getCapturePointMaps()
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('scalp_images').delete().eq('id', imageId).select('*').single()
  if (error) throw new Error(`delete scalp analysis image: ${error.message}`)
  return mapImage(data as ScalpImageTrackingRow, byId)
}

export async function listTrackingImagesForSession(sessionId: string) {
  if (shouldUseMockRepository()) return mockRepository.listTrackingImagesForSession(sessionId)
  if (!await getTrackingSession(sessionId)) return []
  const { byId } = await getCapturePointMaps()
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('scalp_images').select('*').eq('session_id', sessionId)
  if (error) throw new Error(`list scalp analysis images: ${error.message}`)
  return ((data ?? []) as ScalpImageTrackingRow[])
    .map((row) => mapImage(row, byId))
    .filter((image) => SCALP_ANALYSIS_AREA_KEYS.includes(image.area_key))
    .sort((a, b) => a.area_key.localeCompare(b.area_key) || a.image_index - b.image_index)
}

export async function listTrackingAreaSummariesForCustomer(customerId: string) {
  if (shouldUseMockRepository()) return mockRepository.listTrackingAreaSummariesForCustomer(customerId)
  const { byId } = await getCapturePointMaps()
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('scalp_area_summaries').select('*').eq('customer_id', customerId)
  if (error) throw new Error(`list scalp area summaries: ${error.message}`)
  return ((data ?? []) as ScalpAreaSummaryRow[]).map((row) => mapSummary(row, byId))
}

export async function upsertTrackingAreaSummary(input: Omit<ScalpAreaSummary, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
  if (shouldUseMockRepository()) return mockRepository.upsertTrackingAreaSummary(input)
  const session = await getTrackingSession(input.session_id)
  if (!session || session.customer_id !== input.customer_id) {
    throw new Error('session_not_found: Tracking summary session does not belong to customer.')
  }
  const { byCode, byId } = await getCapturePointMaps()
  const capturePointId = byCode.get(input.area_key)
  if (!capturePointId) throw new Error(`Unknown area key: ${input.area_key}`)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_area_summaries')
    .upsert(
      {
        id: input.id,
        customer_id: input.customer_id,
        session_id: input.session_id,
        capture_point_id: capturePointId,
        average_coarse_hair_count: input.average_coarse_hair_count,
        average_baby_hair_count: input.average_baby_hair_count,
        average_empty_follicle_count: input.average_empty_follicle_count,
        average_blockage_count: input.average_blockage_count,
        average_scalp_empty_ratio: input.average_scalp_empty_ratio,
        average_redness_score: input.average_redness_score,
        average_oiliness_score: input.average_oiliness_score,
        average_density_score: input.average_density_score,
        capture_consistency_score: input.capture_consistency_score ?? null,
        compared_to_previous_json: input.compared_to_previous_json,
        compared_to_baseline_json: input.compared_to_baseline_json,
        report_summary: input.report_summary,
      },
      { onConflict: 'session_id,capture_point_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(`upsert scalp area summary: ${error.message}`)
  return mapSummary(data as ScalpAreaSummaryRow, byId)
}

export async function deleteTrackingAreaSummary(sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  if (shouldUseMockRepository()) return mockRepository.deleteTrackingAreaSummary(sessionId, areaKey)
  if (!await getTrackingSession(sessionId)) return
  const { byCode } = await getCapturePointMaps()
  const capturePointId = byCode.get(areaKey)
  if (!capturePointId) throw new Error(`Unknown area key: ${areaKey}`)
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('scalp_area_summaries')
    .delete()
    .eq('session_id', sessionId)
    .eq('capture_point_id', capturePointId)
  if (error) throw new Error(`delete scalp area summary: ${error.message}`)
}

export async function getTrackingAreaSummary(sessionId: string, areaKey: ScalpAnalysisAreaKey) {
  if (shouldUseMockRepository()) return mockRepository.getTrackingAreaSummary(sessionId, areaKey)
  if (!await getTrackingSession(sessionId)) return null
  const { byCode, byId } = await getCapturePointMaps()
  const capturePointId = byCode.get(areaKey)
  if (!capturePointId) throw new Error(`Unknown area key: ${areaKey}`)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_area_summaries')
    .select('*')
    .eq('session_id', sessionId)
    .eq('capture_point_id', capturePointId)
    .maybeSingle()
  if (error) throw new Error(`get scalp area summary: ${error.message}`)
  return data ? mapSummary(data as ScalpAreaSummaryRow, byId) : null
}

export async function getTrackingSessionStateRecord(sessionId: string): Promise<ScalpAnalysisSessionState | null> {
  if (shouldUseMockRepository()) return mockRepository.getTrackingSessionStateRecord(sessionId)
  const [session, { byId }, images] = await Promise.all([
    getTrackingSession(sessionId),
    getCapturePointMaps(),
    listTrackingImagesForSession(sessionId),
  ])

  if (!session) return null
  const customerMaybe = await getCustomerRecord(session.customer_id)
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('scalp_area_summaries').select('*').eq('session_id', sessionId)
  if (error) throw new Error(`session area summaries: ${error.message}`)
  const summaries = ((data ?? []) as ScalpAreaSummaryRow[]).map((row) => mapSummary(row, byId))

  const areas = SCALP_ANALYSIS_AREA_KEYS.map((areaKey) => {
    const areaImages = images.filter((image) => image.area_key === areaKey)
    const summary = summaries.find((item) => item.area_key === areaKey) ?? null
    const confirmedImages = areaImages.filter(isConfirmedScalpAnalysisImage)
    return {
      area_key: areaKey,
      label: SCALP_ANALYSIS_AREA_LABELS[areaKey],
      images: areaImages,
      summary,
      uploaded_images: areaImages.length,
      confirmed_images: confirmedImages.length,
      pending_confirmation_images: areaImages.filter((image) => !isConfirmedScalpAnalysisImage(image)).length,
      missing_images: Math.max(0, 3 - areaImages.length),
      ready_for_average: areaImages.length === 3 && areaImages.every(isConfirmedScalpAnalysisImage),
    }
  })

  const readyAreas = areas.filter((area) => area.ready_for_average).length
  const uploadedImages = areas.reduce((total, area) => total + area.uploaded_images, 0)
  const confirmedImages = areas.reduce((total, area) => total + area.confirmed_images, 0)
  const retryableImages = images.filter(
    (image) => image.analysis_status === 'uploaded' || image.analysis_status === 'ai_failed',
  )

  return {
    session,
    customer: customerMaybe
      ? {
          id: customerMaybe.id,
          name: customerMaybe.name,
          phone: customerMaybe.phone,
        }
      : null,
    areas,
    progress: {
      total_images: SCALP_ANALYSIS_AREA_KEYS.length * 3,
      uploaded_images: uploadedImages,
      confirmed_images: confirmedImages,
      total_areas: SCALP_ANALYSIS_AREA_KEYS.length,
      ready_areas: readyAreas,
      pending_confirmation_areas: areas.filter(
        (area) => area.uploaded_images > 0 && !area.ready_for_average,
      ).length,
      ai_retryable_images: retryableImages.length,
      ai_failed_images: retryableImages.filter((image) => image.analysis_status === 'ai_failed').length,
    },
    report_lines: summaries
      .sort((a, b) => a.area_key.localeCompare(b.area_key))
      .map((summary) => summary.report_summary)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  }
}
