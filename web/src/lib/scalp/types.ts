import type { CapturePointCode, ImageType, MetricKey } from '@/lib/scalp/constants'

export type UUID = string

export type Customer = {
  id: UUID
  name: string
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ScalpSession = {
  id: UUID
  customer_id: UUID
  check_date: string
  staff_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ScalpImage = {
  id: UUID
  customer_id: UUID
  session_id: UUID
  capture_point_code: CapturePointCode
  shot_index: 1 | 2 | 3
  image_type: ImageType
  magnification: string | null
  lighting_mode: string | null
  hair_state: string | null
  image_url: string
  created_at: string
  updated_at: string
}

export type ScalpImageMetrics = {
  id: UUID
  image_id: UUID
  oil_score: number | null
  redness_score: number | null
  density_score: number | null
  blockage_score: number | null
  dandruff_score: number | null
  sensitivity_score: number | null
  created_at: string
  updated_at: string
}

export type ScalpPointSummary = {
  id: UUID
  customer_id: UUID
  session_id: UUID
  capture_point_code: CapturePointCode
  oil_avg: number | null
  redness_avg: number | null
  density_avg: number | null
  blockage_avg: number | null
  dandruff_avg: number | null
  sensitivity_avg: number | null
  completed: boolean
  computed_at: string
}

export type ScalpComparison = {
  id: UUID
  customer_id: UUID
  capture_point_code: CapturePointCode
  current_session_id: UUID
  previous_session_id: UUID
  oil_change: number | null
  redness_change: number | null
  density_change: number | null
  blockage_change: number | null
  dandruff_change: number | null
  sensitivity_change: number | null
  comparison_summary: string
  created_at: string
}

export type MetricInput = Partial<Record<MetricKey, number | null>>

export type ScalpAiShotAnalysis = {
  id: UUID
  customer_id: UUID
  session_id: UUID
  image_id: UUID
  capture_point_code: CapturePointCode
  shot_index: 1 | 2 | 3
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

export type ScalpAiPointAnalysis = {
  id: UUID
  customer_id: UUID
  session_id: UUID
  capture_point_code: CapturePointCode
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
