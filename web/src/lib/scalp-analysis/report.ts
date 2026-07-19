import { SCALP_ANALYSIS_AREA_LABELS, type ScalpAnalysisAreaKey } from './constants'
import { calculateCaptureConsistencyScore } from './logic'
import type {
  ScalpAnalysisSessionState,
  ScalpAreaSummary,
  ScalpSessionComparison,
} from './types'

export const SCALP_REPORT_METRIC_KEYS = [
  'average_baby_hair_count',
  'average_coarse_hair_count',
  'average_empty_follicle_count',
  'average_blockage_count',
  'average_scalp_empty_ratio',
  'average_redness_score',
  'average_oiliness_score',
  'average_density_score',
] as const

export type ScalpReportMetricKey = (typeof SCALP_REPORT_METRIC_KEYS)[number]

export const SCALP_REPORT_METRIC_LABELS: Record<ScalpReportMetricKey, string> = {
  average_baby_hair_count: '幼毛',
  average_coarse_hair_count: '粗髮',
  average_empty_follicle_count: '空毛囊',
  average_blockage_count: '堵塞',
  average_scalp_empty_ratio: '空白頭皮比例',
  average_redness_score: '紅腫',
  average_oiliness_score: '出油',
  average_density_score: '密度分數',
}

export type ScalpReportArea = {
  area_key: ScalpAnalysisAreaKey
  label: string
  status: 'complete' | 'incomplete'
  uploaded_images: number
  confirmed_images: number
  consistency_score: number | null
  consistency_warning: boolean
  metrics: Record<ScalpReportMetricKey, number | null>
  compared_to_previous: ScalpSessionComparison | null
  compared_to_baseline: ScalpSessionComparison | null
  report_summary: string | null
}

export type ScalpAnalysisReport = {
  session_id: string
  customer_id: string
  customer_name: string
  session_date: string
  session_complete: boolean
  completed_areas: number
  incomplete_areas: number
  areas: ScalpReportArea[]
  warnings: string[]
}

function emptyMetrics(): Record<ScalpReportMetricKey, number | null> {
  return Object.fromEntries(SCALP_REPORT_METRIC_KEYS.map((key) => [key, null])) as Record<
    ScalpReportMetricKey,
    number | null
  >
}

function summaryMetrics(summary: ScalpAreaSummary | null) {
  if (!summary) return emptyMetrics()
  return {
    average_baby_hair_count: summary.average_baby_hair_count,
    average_coarse_hair_count: summary.average_coarse_hair_count,
    average_empty_follicle_count: summary.average_empty_follicle_count,
    average_blockage_count: summary.average_blockage_count,
    average_scalp_empty_ratio: summary.average_scalp_empty_ratio,
    average_redness_score: summary.average_redness_score,
    average_oiliness_score: summary.average_oiliness_score,
    average_density_score: summary.average_density_score,
  }
}

export function buildScalpAnalysisReport(
  state: Pick<ScalpAnalysisSessionState, 'session' | 'customer' | 'areas'>,
): ScalpAnalysisReport {
  const areas = state.areas.map((area) => {
    const complete = area.ready_for_average && Boolean(area.summary)
    const summary = complete ? area.summary : null
    const consistencyScore = complete ? calculateCaptureConsistencyScore(area.images) : null
    return {
      area_key: area.area_key,
      label: area.label || SCALP_ANALYSIS_AREA_LABELS[area.area_key],
      status: complete ? 'complete' : 'incomplete',
      uploaded_images: area.uploaded_images,
      confirmed_images: area.confirmed_images,
      consistency_score: consistencyScore,
      consistency_warning: consistencyScore !== null && consistencyScore < 70,
      metrics: summaryMetrics(summary),
      compared_to_previous: summary?.compared_to_previous_json ?? null,
      compared_to_baseline: summary?.compared_to_baseline_json ?? null,
      report_summary: summary?.report_summary ?? null,
    } satisfies ScalpReportArea
  })
  const completedAreas = areas.filter((area) => area.status === 'complete').length
  const incompleteAreas = areas.length - completedAreas

  return {
    session_id: state.session.id,
    customer_id: state.session.customer_id,
    customer_name: state.customer?.name ?? '未命名客人',
    session_date: state.session.check_date,
    session_complete: areas.length > 0 && incompleteAreas === 0,
    completed_areas: completedAreas,
    incomplete_areas: incompleteAreas,
    areas,
    warnings: [
      ...areas
        .filter((area) => area.status === 'incomplete')
        .map(
          (area) =>
            `${area.label} 尚未完成 3 張 confirmed 圖片，暫不納入正式平均及前後比較。`,
        ),
      ...areas
        .filter((area) => area.consistency_warning)
        .map(
          (area) =>
            `${area.label} 三張圖片一致性（capture consistency）低於 70%，正式解讀前請覆核或重拍。`,
        ),
    ],
  }
}
