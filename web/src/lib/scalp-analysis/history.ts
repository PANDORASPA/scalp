import type { ScalpSession } from '@/lib/scalp/types'

import { SCALP_ANALYSIS_AREA_KEYS, SCALP_ANALYSIS_AREA_LABELS, type ScalpAnalysisAreaKey } from './constants'
import type { ScalpAreaSummary } from './types'

export const SCALP_HISTORY_METRICS = [
  'baby_hair_count',
  'coarse_hair_count',
  'scalp_empty_ratio',
  'density_score',
  'blockage_count',
  'redness_score',
  'oiliness_score',
] as const

export type ScalpHistoryMetric = (typeof SCALP_HISTORY_METRICS)[number]

export const SCALP_HISTORY_METRIC_LABELS: Record<ScalpHistoryMetric, string> = {
  baby_hair_count: '幼毛數量',
  coarse_hair_count: '粗髮數量',
  scalp_empty_ratio: '空白頭皮比例',
  density_score: '密度分數',
  blockage_count: '堵塞數量',
  redness_score: '紅腫分數',
  oiliness_score: '出油分數',
}

export type ScalpAnalysisHistoryPoint = {
  session_id: string
  session_date: string
  area_key: ScalpAnalysisAreaKey
  area_label: string
  baby_hair_count: number | null
  coarse_hair_count: number | null
  scalp_empty_ratio: number | null
  density_score: number | null
  blockage_count: number | null
  redness_score: number | null
  oiliness_score: number | null
  capture_consistency_score?: number | null
}

type HistorySession = Pick<ScalpSession, 'id' | 'check_date'>
type HistorySummary = Pick<
  ScalpAreaSummary,
  | 'session_id'
  | 'area_key'
  | 'average_baby_hair_count'
  | 'average_coarse_hair_count'
  | 'average_scalp_empty_ratio'
  | 'average_density_score'
  | 'average_blockage_count'
  | 'average_redness_score'
  | 'average_oiliness_score'
  | 'capture_consistency_score'
>

export function buildScalpAnalysisHistory(
  sessions: HistorySession[],
  summaries: HistorySummary[],
): ScalpAnalysisHistoryPoint[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const areaOrder = new Map(SCALP_ANALYSIS_AREA_KEYS.map((areaKey, index) => [areaKey, index]))

  return summaries
    .flatMap((summary) => {
      const session = sessionById.get(summary.session_id)
      if (!session) return []
      return [
        {
          session_id: summary.session_id,
          session_date: session.check_date,
          area_key: summary.area_key,
          area_label: SCALP_ANALYSIS_AREA_LABELS[summary.area_key],
          baby_hair_count: summary.average_baby_hair_count,
          coarse_hair_count: summary.average_coarse_hair_count,
          scalp_empty_ratio: summary.average_scalp_empty_ratio,
          density_score: summary.average_density_score,
          blockage_count: summary.average_blockage_count,
          redness_score: summary.average_redness_score,
          oiliness_score: summary.average_oiliness_score,
          capture_consistency_score: summary.capture_consistency_score ?? null,
        },
      ]
    })
    .sort((a, b) => {
      const dateDelta = new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
      if (dateDelta !== 0) return dateDelta
      return (areaOrder.get(a.area_key) ?? Number.MAX_SAFE_INTEGER) - (areaOrder.get(b.area_key) ?? Number.MAX_SAFE_INTEGER)
    })
}

export function getScalpHistoryMetricValue(
  point: ScalpAnalysisHistoryPoint,
  metric: ScalpHistoryMetric,
) {
  return point[metric]
}
