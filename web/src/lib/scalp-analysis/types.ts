import type { ScalpSession } from '@/lib/scalp/types'

import type { ScalpAnalysisAreaKey, ScalpAnnotationType } from './constants'

export type ScalpMarkerPoint = {
  id: string
  x: number
  y: number
  confidence?: number | null
}

export type ScalpMarkerCircle = {
  id: string
  x: number
  y: number
  radius: number
  confidence?: number | null
  severity?: number | null
}

export type ScalpAnalysisScores = {
  scalp_empty_ratio: number | null
  redness_score: number | null
  oiliness_score: number | null
  blockage_score: number | null
  density_score: number | null
}

export type ScalpAnalysisAnnotations = {
  coarse_hairs: ScalpMarkerPoint[]
  baby_hairs: ScalpMarkerPoint[]
  empty_follicles: ScalpMarkerPoint[]
  blockages: ScalpMarkerCircle[]
  redness_regions: ScalpMarkerCircle[]
  scores: ScalpAnalysisScores
  notes: string
  image_width?: number | null
  image_height?: number | null
}

export type ScalpImageStats = {
  coarse_hair_count: number | null
  baby_hair_count: number | null
  empty_follicle_count: number | null
  blockage_count: number | null
  scalp_empty_ratio: number | null
  redness_score: number | null
  oiliness_score: number | null
  density_score: number | null
}

export type ScalpSessionComparisonMetric = {
  previous: number | null
  current: number | null
  delta: number | null
  direction: 'improved' | 'declined' | 'stable' | 'inconclusive'
  label: string
}

export type ScalpSessionComparison = {
  reference_session_id: string
  reference_session_date: string
  baby_hair_count: ScalpSessionComparisonMetric
  coarse_hair_count: ScalpSessionComparisonMetric
  scalp_empty_ratio: ScalpSessionComparisonMetric
  density_score: ScalpSessionComparisonMetric
  redness_score: ScalpSessionComparisonMetric
  oiliness_score: ScalpSessionComparisonMetric
  blockage_count: ScalpSessionComparisonMetric
  summary_lines: string[]
}

export type ScalpAnalysisImage = {
  id: string
  customer_id: string
  session_id: string
  area_key: ScalpAnalysisAreaKey
  image_index: 1 | 2 | 3
  image_url: string
  drive_file_id: string | null
  storage_provider: string
  storage_object_key: string | null
  analysis_status: 'pending' | 'uploaded' | 'ai_ready' | 'ai_failed' | 'confirmed'
  ai_result_json: ScalpAnalysisAnnotations | null
  confirmed_annotations_json: ScalpAnalysisAnnotations | null
  analysis_notes?: string | null
  stats: ScalpImageStats
  created_at: string
  updated_at: string
}

export type ScalpAreaSummary = {
  id: string
  customer_id: string
  session_id: string
  area_key: ScalpAnalysisAreaKey
  average_coarse_hair_count: number | null
  average_baby_hair_count: number | null
  average_empty_follicle_count: number | null
  average_blockage_count: number | null
  average_scalp_empty_ratio: number | null
  average_redness_score: number | null
  average_oiliness_score: number | null
  average_density_score: number | null
  compared_to_previous_json: ScalpSessionComparison | null
  compared_to_baseline_json: ScalpSessionComparison | null
  report_summary: string | null
  created_at: string
  updated_at: string
}

export type ScalpAreaSessionState = {
  area_key: ScalpAnalysisAreaKey
  label: string
  images: ScalpAnalysisImage[]
  summary: ScalpAreaSummary | null
  uploaded_images: number
  confirmed_images: number
  pending_confirmation_images: number
  missing_images: number
  ready_for_average: boolean
}

export type ScalpAnalysisSessionState = {
  session: ScalpSession
  customer: {
    id: string
    name: string
    phone: string | null
  } | null
  areas: ScalpAreaSessionState[]
  progress: {
    total_images: number
    uploaded_images: number
    confirmed_images: number
    total_areas: number
    ready_areas: number
    pending_confirmation_areas: number
  }
  report_lines: string[]
}

export type ScalpEditorMarker = {
  id: string
  type: ScalpAnnotationType
  x: number
  y: number
  radius?: number
  severity?: number | null
  confidence?: number | null
}
