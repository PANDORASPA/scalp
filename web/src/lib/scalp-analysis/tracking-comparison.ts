import {
  SCALP_ANALYSIS_AREA_KEYS,
  type ScalpAnalysisAreaKey,
} from './constants'
import {
  SCALP_HISTORY_METRICS,
  type ScalpAnalysisHistoryPoint,
  type ScalpHistoryMetric,
} from './history'

export type TrackingComparisonMetric = {
  baseline: number | null
  current: number | null
  delta: number | null
}

export type TrackingMetricDirection = 'improved' | 'declined' | 'stable' | 'inconclusive'

const LOWER_IS_BETTER_METRICS = new Set<ScalpHistoryMetric>([
  'scalp_empty_ratio',
  'blockage_count',
  'redness_score',
  'oiliness_score',
])

export function getTrackingMetricDirection(
  metric: ScalpHistoryMetric,
  delta: number | null,
): TrackingMetricDirection {
  if (delta === null || !Number.isFinite(delta)) return 'inconclusive'
  if (delta === 0) return 'stable'
  const lowerIsBetter = LOWER_IS_BETTER_METRICS.has(metric)
  return lowerIsBetter ? (delta < 0 ? 'improved' : 'declined') : (delta > 0 ? 'improved' : 'declined')
}

export type TrackingComparisonRow = {
  area_key: ScalpAnalysisAreaKey
  area_label: string
  ready: boolean
  baseline_session_id: string | null
  baseline_session_date: string | null
  current_session_id: string | null
  current_session_date: string | null
  metrics: Record<ScalpHistoryMetric, TrackingComparisonMetric>
}

function compareHistoryPoints(a: ScalpAnalysisHistoryPoint, b: ScalpAnalysisHistoryPoint) {
  const dateDelta = new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
  return dateDelta !== 0 ? dateDelta : a.session_id.localeCompare(b.session_id)
}

function getMetric(point: ScalpAnalysisHistoryPoint | undefined, metric: ScalpHistoryMetric) {
  const value = point?.[metric]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function buildTrackingComparisonRows(history: ScalpAnalysisHistoryPoint[]): TrackingComparisonRow[] {
  const byArea = new Map<ScalpAnalysisAreaKey, ScalpAnalysisHistoryPoint[]>()
  for (const point of history) {
    const points = byArea.get(point.area_key) ?? []
    points.push(point)
    byArea.set(point.area_key, points)
  }

  return SCALP_ANALYSIS_AREA_KEYS.flatMap((areaKey) => {
    const points = byArea.get(areaKey)
    if (!points?.length) return []

    const ordered = [...points].sort(compareHistoryPoints)
    const baseline = ordered[0]
    const current = ordered.at(-1)
    const ready = ordered.length >= 2

    const metrics = Object.fromEntries(
      SCALP_HISTORY_METRICS.map((metric) => {
        const baselineValue = getMetric(baseline, metric)
        const currentValue = getMetric(current, metric)
        return [
          metric,
          {
            baseline: baselineValue,
            current: currentValue,
            delta: ready && baselineValue !== null && currentValue !== null
              ? Math.round((currentValue - baselineValue) * 10) / 10
              : null,
          },
        ]
      }),
    ) as Record<ScalpHistoryMetric, TrackingComparisonMetric>

    return [{
      area_key: areaKey,
      area_label: baseline.area_label,
      ready,
      baseline_session_id: baseline.session_id,
      baseline_session_date: baseline.session_date,
      current_session_id: current?.session_id ?? null,
      current_session_date: current?.session_date ?? null,
      metrics,
    }]
  })
}
