import 'server-only'

import { explainSupabaseErrorMessage } from '@/lib/config/supabase'
import type { MockDb } from '@/lib/mockdb/store'
import type { TrackingAreaProgress } from '@/lib/customers/workspace'
import type {
  Customer,
  ScalpAiPointAnalysis,
  ScalpAiShotAnalysis,
  ScalpComparison,
  ScalpImage,
  ScalpImageMetrics,
  ScalpPointSummary,
  ScalpSession,
} from '@/lib/scalp/types'
import { belongsToSessionOwner } from '@/lib/scalp/ownership'

import { getSupabaseAdminClient } from './client'
import { getScalpImageUrl } from './storage'

type CapturePointRow = {
  id: string
  code: string
  display_name: string | null
  sort_order: number
}

type ScalpImageRow = {
  id: string
  customer_id: string
  session_id: string
  capture_point_id: string
  shot_index: number
  image_type: string
  magnification: string | null
  lighting_mode: string | null
  hair_state: string | null
  image_url: string
  storage_provider: string | null
  storage_object_key: string | null
  created_at: string
  updated_at: string
}

export type ScalpImageStorageRef = {
  customer_id: string
  session_id: string
  capture_point_code: string
  shot_index: 1 | 2 | 3
  drive_file_id: string | null
  storage_provider: string | null
  storage_object_key: string | null
}

type ScalpImageStorageRefRow = {
  customer_id: string
  session_id: string
  capture_point_id: string
  shot_index: number
  drive_file_id: string | null
  storage_provider: string | null
  storage_object_key: string | null
}

type ScalpPointSummaryRow = {
  id: string
  customer_id: string
  session_id: string
  capture_point_id: string
  oil_avg: number | null
  redness_avg: number | null
  density_avg: number | null
  blockage_avg: number | null
  dandruff_avg: number | null
  sensitivity_avg: number | null
  completed: boolean
  computed_at: string
}

type ScalpComparisonRow = {
  id: string
  customer_id: string
  capture_point_id: string
  current_session_id: string
  previous_session_id: string
  oil_change: number | null
  redness_change: number | null
  density_change: number | null
  blockage_change: number | null
  dandruff_change: number | null
  sensitivity_change: number | null
  comparison_summary: string
  created_at: string
}

type ScalpAiShotAnalysisRow = {
  id: string
  customer_id: string
  session_id: string
  image_id: string
  capture_point_id: string
  shot_index: number
  hair_count_estimate: number | null
  confidence_score: number | null
  provider_name: string
  analysis_method: string
  model_version: string | null
  status: 'pending' | 'ready'
  notes: string | null
  fallback_used: boolean
  fallback_reason: string | null
  raw_output_ref: string | null
  created_at: string
  updated_at: string
}

type ScalpAiPointAnalysisRow = {
  id: string
  customer_id: string
  session_id: string
  capture_point_id: string
  hair_count_avg_3shot: number | null
  hair_count_min: number | null
  hair_count_max: number | null
  completed: boolean
  provider_name: string
  analysis_method: string
  confidence_score: number | null
  capture_consistency_score: number | null
  change_vs_previous: number | null
  fallback_used: boolean
  trend_direction: 'improved' | 'declined' | 'stable' | 'inconclusive'
  trend_summary: string
  computed_at: string
}

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown Supabase error'
}

async function queryMany<T>(table: string, select = '*') {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from(table).select(select)
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as T[]
}

async function queryFiltered<T>(table: string, column: string, value: string, select = '*') {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from(table).select(select).eq(column, value)
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as T[]
}

async function querySingle<T>(table: string, column: string, value: string, select = '*') {
  const rows = await queryFiltered<T>(table, column, value, select)
  return rows[0] ?? null
}

async function getCapturePointRows() {
  return queryMany<CapturePointRow>('scalp_capture_points')
}

async function getCapturePointMaps() {
  const points = await getCapturePointRows()
  const byId = new Map(points.map((point) => [point.id, point.code]))
  const byCode = new Map(points.map((point) => [point.code, point.id]))
  return { byId, byCode }
}

function toCapturePointCode(byId: Map<string, string>, capturePointId: string) {
  const code = byId.get(capturePointId)
  if (!code) throw new Error(`Unknown capture point id: ${capturePointId}`)
  return code as ScalpImage['capture_point_code']
}

function mapImage(row: ScalpImageRow, byId: Map<string, string>): ScalpImage {
  return {
    id: row.id,
    customer_id: row.customer_id,
    session_id: row.session_id,
    capture_point_code: toCapturePointCode(byId, row.capture_point_id),
    shot_index: row.shot_index as 1 | 2 | 3,
    image_type: row.image_type as ScalpImage['image_type'],
    magnification: row.magnification,
    lighting_mode: row.lighting_mode,
    hair_state: row.hair_state,
    image_url:
      row.storage_provider === 'supabase' && row.storage_object_key
        ? getScalpImageUrl(row.storage_object_key)
        : row.image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapPointSummary(row: ScalpPointSummaryRow, byId: Map<string, string>): ScalpPointSummary {
  return {
    id: row.id,
    customer_id: row.customer_id,
    session_id: row.session_id,
    capture_point_code: toCapturePointCode(byId, row.capture_point_id),
    oil_avg: row.oil_avg,
    redness_avg: row.redness_avg,
    density_avg: row.density_avg,
    blockage_avg: row.blockage_avg,
    dandruff_avg: row.dandruff_avg,
    sensitivity_avg: row.sensitivity_avg,
    completed: row.completed,
    computed_at: row.computed_at,
  }
}

function mapComparison(row: ScalpComparisonRow, byId: Map<string, string>): ScalpComparison {
  return {
    id: row.id,
    customer_id: row.customer_id,
    capture_point_code: toCapturePointCode(byId, row.capture_point_id),
    current_session_id: row.current_session_id,
    previous_session_id: row.previous_session_id,
    oil_change: row.oil_change,
    redness_change: row.redness_change,
    density_change: row.density_change,
    blockage_change: row.blockage_change,
    dandruff_change: row.dandruff_change,
    sensitivity_change: row.sensitivity_change,
    comparison_summary: row.comparison_summary,
    created_at: row.created_at,
  }
}

function mapAiShotAnalysis(row: ScalpAiShotAnalysisRow, byId: Map<string, string>): ScalpAiShotAnalysis {
  return {
    id: row.id,
    customer_id: row.customer_id,
    session_id: row.session_id,
    image_id: row.image_id,
    capture_point_code: toCapturePointCode(byId, row.capture_point_id),
    shot_index: row.shot_index as 1 | 2 | 3,
    hair_count_estimate: row.hair_count_estimate,
    confidence_score: row.confidence_score,
    provider_name: row.provider_name,
    analysis_method: row.analysis_method,
    model_version: row.model_version,
    status: row.status,
    notes: row.notes,
    fallback_used: row.fallback_used,
    fallback_reason: row.fallback_reason,
    raw_output_ref: row.raw_output_ref,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapAiPointAnalysis(row: ScalpAiPointAnalysisRow, byId: Map<string, string>): ScalpAiPointAnalysis {
  return {
    id: row.id,
    customer_id: row.customer_id,
    session_id: row.session_id,
    capture_point_code: toCapturePointCode(byId, row.capture_point_id),
    hair_count_avg_3shot: row.hair_count_avg_3shot,
    hair_count_min: row.hair_count_min,
    hair_count_max: row.hair_count_max,
    completed: row.completed,
    provider_name: row.provider_name,
    analysis_method: row.analysis_method,
    confidence_score: row.confidence_score,
    capture_consistency_score: row.capture_consistency_score,
    change_vs_previous: row.change_vs_previous,
    fallback_used: row.fallback_used,
    trend_direction: row.trend_direction,
    trend_summary: row.trend_summary,
    computed_at: row.computed_at,
  }
}

export async function getWorkspaceSnapshot(): Promise<
  Pick<MockDb, 'customers' | 'sessions' | 'pointSummaries'> & {
    trackingSessions: ScalpSession[]
    trackingCompletedAreas: TrackingAreaProgress[]
  }
> {
  const { byId } = await getCapturePointMaps()
  const [customers, sessionResult, pointSummaryRows, trackingAreaResult] = await Promise.all([
    queryMany<Customer>('customers'),
    getSupabaseAdminClient()
      .from('scalp_sessions')
      .select('*')
      .then(({ data, error }) => {
        if (error) throw new Error(`scalp_sessions: ${error.message}`)
        return (data ?? []) as ScalpSession[]
      }),
    queryMany<ScalpPointSummaryRow>('scalp_point_summaries'),
    getSupabaseAdminClient()
      .from('scalp_area_summaries')
      .select('customer_id,session_id')
      .then(({ data, error }) => {
        if (error) throw new Error(`scalp_area_summaries: ${error.message}`)
        return (data ?? []) as TrackingAreaProgress[]
      }),
  ])

  const sessions = sessionResult.filter(
    (session) => (session as ScalpSession & { workflow_type?: string }).workflow_type !== 'scalp_analysis_tracking',
  )
  const trackingSessions = sessionResult.filter(
    (session) => (session as ScalpSession & { workflow_type?: string }).workflow_type === 'scalp_analysis_tracking',
  )

  return {
    customers,
    sessions,
    pointSummaries: pointSummaryRows.map((row) => mapPointSummary(row, byId)),
    trackingSessions,
    trackingCompletedAreas: trackingAreaResult,
  }
}

export async function getCustomerSnapshot(customerId: string): Promise<MockDb> {
  const { byId } = await getCapturePointMaps()
  const [customerRows, sessions, imageRows, pointSummaryRows, comparisonRows, aiShotRows, aiPointRows] = await Promise.all([
    queryFiltered<Customer>('customers', 'id', customerId),
    queryFiltered<ScalpSession>('scalp_sessions', 'customer_id', customerId),
    queryFiltered<ScalpImageRow>('scalp_images', 'customer_id', customerId),
    queryFiltered<ScalpPointSummaryRow>('scalp_point_summaries', 'customer_id', customerId),
    queryFiltered<ScalpComparisonRow>('scalp_comparisons', 'customer_id', customerId),
    queryFiltered<ScalpAiShotAnalysisRow>('scalp_ai_shot_analyses', 'customer_id', customerId),
    queryFiltered<ScalpAiPointAnalysisRow>('scalp_ai_point_analyses', 'customer_id', customerId),
  ])

  const images = imageRows.map((row) => mapImage(row, byId))
  const imageIds = images.map((image) => image.id)
  const metrics = imageIds.length > 0
    ? await getSupabaseAdminClient().from('scalp_image_metrics').select('*').in('image_id', imageIds).then(({ data, error }) => {
        if (error) throw new Error(`scalp_image_metrics: ${error.message}`)
        return (data ?? []) as ScalpImageMetrics[]
      })
    : []

  return {
    customers: customerRows,
    sessions,
    images,
    metrics,
    pointSummaries: pointSummaryRows.map((row) => mapPointSummary(row, byId)),
    comparisons: comparisonRows.map((row) => mapComparison(row, byId)),
    aiShotAnalyses: aiShotRows.map((row) => mapAiShotAnalysis(row, byId)),
    aiPointAnalyses: aiPointRows.map((row) => mapAiPointAnalysis(row, byId)),
  }
}

export async function getSessionStateFromSupabase(sessionId: string) {
  const session = await querySingle<ScalpSession>('scalp_sessions', 'id', sessionId)
  if (!session) return null

  const snapshot = await getCustomerSnapshot(session.customer_id)
  const customer = snapshot.customers.find((item) => item.id === session.customer_id) ?? null
  const images = snapshot.images.filter((item) => item.session_id === sessionId)
  const metricsByImageId = Object.fromEntries(
    snapshot.metrics
      .filter((metric) => images.some((image) => image.id === metric.image_id))
      .map((metric) => [metric.image_id, metric]),
  )
  const pointSummaries = snapshot.pointSummaries.filter((item) => item.session_id === sessionId)
  const comparisons = snapshot.comparisons.filter((item) => item.current_session_id === sessionId)
  const aiShotAnalysesByImageId = Object.fromEntries(
    snapshot.aiShotAnalyses
      .filter((item) => images.some((image) => image.id === item.image_id))
      .map((item) => [item.image_id, item]),
  )
  const aiPointAnalyses = snapshot.aiPointAnalyses.filter((item) => item.session_id === sessionId)

  return {
    session,
    customer,
    images,
    metricsByImageId,
    pointSummaries,
    comparisons,
    aiShotAnalysesByImageId,
    aiPointAnalyses,
  }
}

export async function getCustomerOverviewFromSupabase(customerId: string) {
  const snapshot = await getCustomerSnapshot(customerId)
  const customer = snapshot.customers.find((item) => item.id === customerId) ?? null
  if (!customer) return null

  const sessions = [...snapshot.sessions]
    .filter((session) => (session as ScalpSession & { workflow_type?: string }).workflow_type !== 'scalp_analysis_tracking')
    .sort((a, b) => b.check_date.localeCompare(a.check_date))
  const latestSession = sessions[0] ?? null
  const latestSummaries = latestSession
    ? snapshot.pointSummaries
        .filter((item) => item.session_id === latestSession.id)
        .sort((a, b) => a.capture_point_code.localeCompare(b.capture_point_code))
    : []

  return {
    customer,
    sessions,
    latestSession,
    latestSummaries,
  }
}

export async function listCustomersFromSupabase(q: string) {
  const client = getSupabaseAdminClient()
  const { data, error } = q
    ? await client
        .from('customers')
        .select('*')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .order('updated_at', { ascending: false })
    : await client.from('customers').select('*').order('updated_at', { ascending: false })

  if (error) throw new Error(`customers: ${error.message}`)
  return (data ?? []) as Customer[]
}

export async function createCustomerInSupabase(input: {
  name: string
  phone: string | null
  notes: string | null
  nowISO: string
}) {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('customers')
    .insert({
      name: input.name,
      phone: input.phone,
      notes: input.notes,
      created_at: input.nowISO,
      updated_at: input.nowISO,
    })
    .select('*')
    .single()

  if (error) throw new Error(`create customer: ${error.message}`)
  return data as Customer
}

export async function getCustomerFromSupabase(customerId: string) {
  return querySingle<Customer>('customers', 'id', customerId)
}

export async function updateCustomerInSupabase(customerId: string, patch: Partial<Customer>) {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('customers')
    .update(patch)
    .eq('id', customerId)
    .select('*')
    .single()

  if (error) throw new Error(`update customer: ${error.message}`)
  return data as Customer
}

export async function deleteCustomerInSupabase(customerId: string) {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('customers').delete().eq('id', customerId).select('*').single()
  if (error) throw new Error(`delete customer: ${error.message}`)
  return data as Customer
}

export async function listSessionsFromSupabase(customerId?: string | null) {
  const client = getSupabaseAdminClient()
  const query = client
    .from('scalp_sessions')
    .select('*')
    .eq('workflow_type', 'legacy_capture')
    .order('check_date', { ascending: false })
  const { data, error } = customerId ? await query.eq('customer_id', customerId) : await query
  if (error) throw new Error(`scalp_sessions: ${error.message}`)
  return (data ?? []) as ScalpSession[]
}

export async function createSessionInSupabase(input: {
  customer_id: string
  check_date: string
  staff_name: string | null
  notes: string | null
  nowISO: string
}) {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_sessions')
    .insert({
      customer_id: input.customer_id,
      check_date: input.check_date,
      staff_name: input.staff_name,
      notes: input.notes,
      workflow_type: 'legacy_capture',
      created_at: input.nowISO,
      updated_at: input.nowISO,
    })
    .select('*')
    .single()
  if (error) throw new Error(`create session: ${error.message}`)
  return data as ScalpSession
}

export async function getSessionFromSupabase(sessionId: string) {
  return querySingle<ScalpSession>('scalp_sessions', 'id', sessionId)
}

export async function getSessionForCustomerFromSupabase(
  sessionId: string,
  customerId: string,
  workflow: 'legacy_capture' | 'scalp_analysis_tracking' = 'legacy_capture',
) {
  const session = await getSessionFromSupabase(sessionId)
  return belongsToSessionOwner(session, customerId, workflow) ? session : null
}

export async function updateSessionInSupabase(sessionId: string, patch: Partial<ScalpSession>) {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select('*')
    .single()
  if (error) throw new Error(`update session: ${error.message}`)
  return data as ScalpSession
}

export async function deleteSessionInSupabase(sessionId: string) {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('scalp_sessions').delete().eq('id', sessionId).select('*').single()
  if (error) throw new Error(`delete session: ${error.message}`)
  return data as ScalpSession
}

export async function touchCustomerInSupabase(customerId: string, nowISO: string) {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('customers').update({ updated_at: nowISO }).eq('id', customerId)
  if (error) throw new Error(`touch customer: ${error.message}`)
}

export async function getImagesForCustomerFromSupabase(customerId: string) {
  const { byId } = await getCapturePointMaps()
  const rows = await queryFiltered<ScalpImageRow>('scalp_images', 'customer_id', customerId)
  return rows.map((row) => mapImage(row, byId))
}

export async function getImagesForSessionFromSupabase(sessionId: string) {
  const { byId } = await getCapturePointMaps()
  const rows = await queryFiltered<ScalpImageRow>('scalp_images', 'session_id', sessionId)
  return rows.map((row) => mapImage(row, byId))
}

function mapStorageRef(row: ScalpImageStorageRefRow, byId: Map<string, string>): ScalpImageStorageRef {
  return {
    customer_id: row.customer_id,
    session_id: row.session_id,
    capture_point_code: byId.get(row.capture_point_id) ?? row.capture_point_id,
    shot_index: row.shot_index as 1 | 2 | 3,
    drive_file_id: row.drive_file_id,
    storage_provider: row.storage_provider,
    storage_object_key: row.storage_object_key,
  }
}

export async function getImageStorageRefsForCustomerFromSupabase(customerId: string) {
  const { byId } = await getCapturePointMaps()
  const rows = await queryFiltered<ScalpImageStorageRefRow>(
    'scalp_images',
    'customer_id',
    customerId,
    'customer_id,session_id,capture_point_id,shot_index,drive_file_id,storage_provider,storage_object_key',
  )
  return rows.map((row) => mapStorageRef(row, byId))
}

export async function getImageStorageRefsForSessionFromSupabase(sessionId: string) {
  const { byId } = await getCapturePointMaps()
  const rows = await queryFiltered<ScalpImageStorageRefRow>(
    'scalp_images',
    'session_id',
    sessionId,
    'customer_id,session_id,capture_point_id,shot_index,drive_file_id,storage_provider,storage_object_key',
  )
  return rows.map((row) => mapStorageRef(row, byId))
}

export async function upsertImageRecordInSupabase(input: {
  customerId: string
  sessionId: string
  capturePointCode: ScalpImage['capture_point_code']
  shotIndex: 1 | 2 | 3
  imageType: string
  magnification: string | null
  lightingMode: string | null
  hairState: string | null
  imageUrl: string | null
  storageObjectKey?: string | null
  nowISO: string
}) {
  const session = await getSessionForCustomerFromSupabase(input.sessionId, input.customerId, 'legacy_capture')
  if (!session) throw new Error('session_not_found: Session does not belong to customer.')

  const { byCode } = await getCapturePointMaps()
  const capturePointId = byCode.get(input.capturePointCode)
  if (!capturePointId) throw new Error(`Unknown capture point code: ${input.capturePointCode}`)

  const client = getSupabaseAdminClient()
  const existing = await client
    .from('scalp_images')
    .select('*')
    .eq('session_id', input.sessionId)
    .eq('capture_point_id', capturePointId)
    .eq('shot_index', input.shotIndex)
    .maybeSingle()
  if (existing.error) throw new Error(`load existing image: ${existing.error.message}`)

  const { data, error } = await client
    .from('scalp_images')
    .upsert(
      {
        customer_id: input.customerId,
        session_id: input.sessionId,
        capture_point_id: capturePointId,
        shot_index: input.shotIndex,
        image_type: input.imageType,
        magnification: input.magnification,
        lighting_mode: input.lightingMode,
        hair_state: input.hairState,
        image_url: input.imageUrl ?? (existing.data as ScalpImageRow | null)?.image_url ?? '',
        storage_provider:
          input.storageObjectKey
            ? 'supabase'
            : (existing.data as ScalpImageRow | null)?.storage_provider ?? 'legacy_local',
        storage_object_key:
          input.storageObjectKey ?? (existing.data as ScalpImageRow | null)?.storage_object_key ?? null,
        updated_at: input.nowISO,
      },
      { onConflict: 'session_id,capture_point_id,shot_index' },
    )
    .select('*')
    .single()

  if (error) throw new Error(`upsert image: ${error.message}`)
  const { byId } = await getCapturePointMaps()
  return mapImage(data as ScalpImageRow, byId)
}

export async function getImageBySessionPointShotInSupabase(params: {
  sessionId: string
  capturePointCode: ScalpImage['capture_point_code']
  shotIndex: 1 | 2 | 3
}) {
  const { byCode, byId } = await getCapturePointMaps()
  const capturePointId = byCode.get(params.capturePointCode)
  if (!capturePointId) throw new Error(`Unknown capture point code: ${params.capturePointCode}`)
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_images')
    .select('*')
    .eq('session_id', params.sessionId)
    .eq('capture_point_id', capturePointId)
    .eq('shot_index', params.shotIndex)
    .maybeSingle()
  if (error) throw new Error(`load existing image: ${error.message}`)
  return data ? mapImage(data as ScalpImageRow, byId) : null
}

export async function upsertMetricsInSupabase(input: {
  imageId: string
  metrics: {
    oil_score: number | null
    redness_score: number | null
    density_score: number | null
    blockage_score: number | null
    dandruff_score: number | null
    sensitivity_score: number | null
  }
  nowISO: string
}) {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_image_metrics')
    .upsert(
      {
        image_id: input.imageId,
        oil_score: input.metrics.oil_score,
        redness_score: input.metrics.redness_score,
        density_score: input.metrics.density_score,
        blockage_score: input.metrics.blockage_score,
        dandruff_score: input.metrics.dandruff_score,
        sensitivity_score: input.metrics.sensitivity_score,
        updated_at: input.nowISO,
      },
      { onConflict: 'image_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(`upsert metrics: ${error.message}`)
  return data as ScalpImageMetrics
}

export async function upsertAiShotAnalysisInSupabase(analysis: ScalpAiShotAnalysis) {
  const { byCode } = await getCapturePointMaps()
  const capturePointId = byCode.get(analysis.capture_point_code)
  if (!capturePointId) throw new Error(`Unknown capture point code: ${analysis.capture_point_code}`)

  const client = getSupabaseAdminClient()
  const { error } = await client.from('scalp_ai_shot_analyses').upsert(
    {
      id: analysis.id,
      customer_id: analysis.customer_id,
      session_id: analysis.session_id,
      image_id: analysis.image_id,
      capture_point_id: capturePointId,
      shot_index: analysis.shot_index,
      hair_count_estimate: analysis.hair_count_estimate,
      confidence_score: analysis.confidence_score,
      provider_name: analysis.provider_name,
      analysis_method: analysis.analysis_method,
      model_version: analysis.model_version,
      status: analysis.status,
      notes: analysis.notes,
      fallback_used: analysis.fallback_used,
      fallback_reason: analysis.fallback_reason,
      raw_output_ref: analysis.raw_output_ref,
      created_at: analysis.created_at,
      updated_at: analysis.updated_at,
    },
    { onConflict: 'image_id' },
  )
  if (error) throw new Error(`upsert ai shot analysis: ${error.message}`)
}

export async function deleteImageBySessionPointShotInSupabase(params: {
  sessionId: string
  capturePointCode: ScalpImage['capture_point_code']
  shotIndex: 1 | 2 | 3
}) {
  const { byCode, byId } = await getCapturePointMaps()
  const capturePointId = byCode.get(params.capturePointCode)
  if (!capturePointId) throw new Error(`Unknown capture point code: ${params.capturePointCode}`)

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('scalp_images')
    .delete()
    .eq('session_id', params.sessionId)
    .eq('capture_point_id', capturePointId)
    .eq('shot_index', params.shotIndex)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`delete image: ${error.message}`)
  }

  return mapImage(data as ScalpImageRow, byId)
}

export async function replaceDerivedPointDataInSupabase(params: {
  customerId: string
  capturePointCode: ScalpImage['capture_point_code']
  snapshot: MockDb
  sessionIds?: string[]
}) {
  const { byCode } = await getCapturePointMaps()
  const capturePointId = byCode.get(params.capturePointCode)
  if (!capturePointId) throw new Error(`Unknown capture point code: ${params.capturePointCode}`)

  const client = getSupabaseAdminClient()

  const targetSessionIds = params.sessionIds ? new Set(params.sessionIds) : null
  const pointSummaries = params.snapshot.pointSummaries.filter(
    (item) =>
      item.customer_id === params.customerId &&
      item.capture_point_code === params.capturePointCode &&
      (!targetSessionIds || targetSessionIds.has(item.session_id)),
  )
  const comparisons = params.snapshot.comparisons.filter(
    (item) =>
      item.customer_id === params.customerId &&
      item.capture_point_code === params.capturePointCode &&
      (!targetSessionIds || targetSessionIds.has(item.current_session_id)),
  )
  const aiPointAnalyses = params.snapshot.aiPointAnalyses.filter(
    (item) =>
      item.customer_id === params.customerId &&
      item.capture_point_code === params.capturePointCode &&
      (!targetSessionIds || targetSessionIds.has(item.session_id)),
  )

  const pointSummaryDelete = client
    .from('scalp_point_summaries')
    .delete()
    .eq('customer_id', params.customerId)
    .eq('capture_point_id', capturePointId)
  const comparisonDelete = client
    .from('scalp_comparisons')
    .delete()
    .eq('customer_id', params.customerId)
    .eq('capture_point_id', capturePointId)
  const aiPointDelete = client
    .from('scalp_ai_point_analyses')
    .delete()
    .eq('customer_id', params.customerId)
    .eq('capture_point_id', capturePointId)

  if (params.sessionIds && params.sessionIds.length > 0) {
    pointSummaryDelete.in('session_id', params.sessionIds)
    comparisonDelete.in('current_session_id', params.sessionIds)
    aiPointDelete.in('session_id', params.sessionIds)
  }

  const [deletePointSummaries, deleteComparisons, deleteAiPoints] = await Promise.all([
    pointSummaryDelete,
    comparisonDelete,
    aiPointDelete,
  ])

  if (deletePointSummaries.error) throw new Error(`delete point summaries: ${deletePointSummaries.error.message}`)
  if (deleteComparisons.error) throw new Error(`delete comparisons: ${deleteComparisons.error.message}`)
  if (deleteAiPoints.error) throw new Error(`delete ai point analyses: ${deleteAiPoints.error.message}`)

  if (pointSummaries.length > 0) {
    const { error } = await client.from('scalp_point_summaries').insert(
      pointSummaries.map((item) => ({
        id: item.id,
        customer_id: item.customer_id,
        session_id: item.session_id,
        capture_point_id: capturePointId,
        oil_avg: item.oil_avg,
        redness_avg: item.redness_avg,
        density_avg: item.density_avg,
        blockage_avg: item.blockage_avg,
        dandruff_avg: item.dandruff_avg,
        sensitivity_avg: item.sensitivity_avg,
        completed: item.completed,
        computed_at: item.computed_at,
      })),
    )
    if (error) throw new Error(`insert point summaries: ${error.message}`)
  }

  if (comparisons.length > 0) {
    const { error } = await client.from('scalp_comparisons').insert(
      comparisons.map((item) => ({
        id: item.id,
        customer_id: item.customer_id,
        capture_point_id: capturePointId,
        current_session_id: item.current_session_id,
        previous_session_id: item.previous_session_id,
        oil_change: item.oil_change,
        redness_change: item.redness_change,
        density_change: item.density_change,
        blockage_change: item.blockage_change,
        dandruff_change: item.dandruff_change,
        sensitivity_change: item.sensitivity_change,
        comparison_summary: item.comparison_summary,
        created_at: item.created_at,
      })),
    )
    if (error) throw new Error(`insert comparisons: ${error.message}`)
  }

  if (aiPointAnalyses.length > 0) {
    const { error } = await client.from('scalp_ai_point_analyses').insert(
      aiPointAnalyses.map((item) => ({
        id: item.id,
        customer_id: item.customer_id,
        session_id: item.session_id,
        capture_point_id: capturePointId,
        hair_count_avg_3shot: item.hair_count_avg_3shot,
        hair_count_min: item.hair_count_min,
        hair_count_max: item.hair_count_max,
        completed: item.completed,
        provider_name: item.provider_name,
        analysis_method: item.analysis_method,
        confidence_score: item.confidence_score,
        capture_consistency_score: item.capture_consistency_score,
        change_vs_previous: item.change_vs_previous,
        fallback_used: item.fallback_used,
        trend_direction: item.trend_direction,
        trend_summary: item.trend_summary,
        computed_at: item.computed_at,
      })),
    )
    if (error) throw new Error(`insert ai point analyses: ${error.message}`)
  }
}

export async function seedCapturePointsIfNeeded() {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('scalp_capture_points').upsert(
    [
      { code: 'front', display_name: 'Front', sort_order: 1 },
      { code: 'left', display_name: 'Left', sort_order: 2 },
      { code: 'right', display_name: 'Right', sort_order: 3 },
      { code: 'crown', display_name: 'Crown', sort_order: 4 },
      { code: 'back', display_name: 'Back', sort_order: 5 },
    ],
    { onConflict: 'code' },
  )
  if (error) throw new Error(`seed capture points: ${error.message}`)
}

export function toRepositoryError(error: unknown) {
  return explainSupabaseErrorMessage(asErrorMessage(error))
}
