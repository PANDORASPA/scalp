import { CAPTURE_POINT_CODES, METRIC_KEYS } from './constants'
import type { CapturePointCode, MetricKey } from './constants'
import type { MetricInput, ScalpPointSummary } from './types'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function isCapturePointCode(value: string): value is CapturePointCode {
  return (CAPTURE_POINT_CODES as readonly string[]).includes(value)
}

export function computePointSummary(params: {
  customerId: string
  sessionId: string
  capturePointCode: CapturePointCode
  metricsByShot: Array<MetricInput>
  nowISO: string
  existingId?: string
}): ScalpPointSummary {
  const { customerId, sessionId, capturePointCode, metricsByShot, nowISO, existingId } = params

  const toAvg = (key: MetricKey) => {
    const values = metricsByShot
      .map((m) => m[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (values.length !== 3) return null
    return round2(values.reduce((a, b) => a + b, 0) / 3)
  }

  const oil_avg = toAvg('oil_score')
  const redness_avg = toAvg('redness_score')
  const density_avg = toAvg('density_score')
  const blockage_avg = toAvg('blockage_score')
  const dandruff_avg = toAvg('dandruff_score')
  const sensitivity_avg = toAvg('sensitivity_score')

  const completed = [oil_avg, redness_avg, density_avg, blockage_avg, dandruff_avg, sensitivity_avg].every(
    (v) => typeof v === 'number',
  )

  return {
    id: existingId ?? crypto.randomUUID(),
    customer_id: customerId,
    session_id: sessionId,
    capture_point_code: capturePointCode,
    oil_avg,
    redness_avg,
    density_avg,
    blockage_avg,
    dandruff_avg,
    sensitivity_avg,
    completed,
    computed_at: nowISO,
  }
}

export function computeComparison(params: {
  customerId: string
  capturePointCode: CapturePointCode
  currentSessionId: string
  previousSessionId: string
  current: ScalpPointSummary
  previous: ScalpPointSummary
  nowISO: string
  existingId?: string
}) {
  const { customerId, capturePointCode, currentSessionId, previousSessionId, current, previous, nowISO, existingId } =
    params

  const diff = (a: number | null, b: number | null) =>
    typeof a === 'number' && typeof b === 'number' ? round2(a - b) : null

  const oil_change = diff(current.oil_avg, previous.oil_avg)
  const redness_change = diff(current.redness_avg, previous.redness_avg)
  const density_change = diff(current.density_avg, previous.density_avg)
  const blockage_change = diff(current.blockage_avg, previous.blockage_avg)
  const dandruff_change = diff(current.dandruff_avg, previous.dandruff_avg)
  const sensitivity_change = diff(current.sensitivity_avg, previous.sensitivity_avg)

  const scoreToLabel = (metric: MetricKey, change: number | null) => {
    if (change === null || change === 0) return 'stable'
    const isDensity = metric === 'density_score'
    const improved = isDensity ? change > 0 : change < 0
    return improved ? 'improved' : 'worsened'
  }

  const labels = {
    oil: scoreToLabel('oil_score', oil_change),
    redness: scoreToLabel('redness_score', redness_change),
    density: scoreToLabel('density_score', density_change),
    blockage: scoreToLabel('blockage_score', blockage_change),
    dandruff: scoreToLabel('dandruff_score', dandruff_change),
    sensitivity: scoreToLabel('sensitivity_score', sensitivity_change),
  }

  const improvedCount = Object.values(labels).filter((v) => v === 'improved').length
  const worsenedCount = Object.values(labels).filter((v) => v === 'worsened').length
  const sameCount = Object.values(labels).filter((v) => v === 'stable').length

  const comparison_summary =
    `Compared with the previous session: ${improvedCount} improved, ${worsenedCount} worsened, ${sameCount} stayed stable. ` +
    `(Oil ${labels.oil} / Redness ${labels.redness} / Density ${labels.density} / Blockage ${labels.blockage} / Dandruff ${labels.dandruff} / Sensitivity ${labels.sensitivity})`

  return {
    id: existingId ?? crypto.randomUUID(),
    customer_id: customerId,
    capture_point_code: capturePointCode,
    current_session_id: currentSessionId,
    previous_session_id: previousSessionId,
    oil_change,
    redness_change,
    density_change,
    blockage_change,
    dandruff_change,
    sensitivity_change,
    comparison_summary,
    created_at: nowISO,
  }
}

export function validateAllMetricsPresent(metrics: MetricInput) {
  return METRIC_KEYS.every((k) => typeof metrics[k] === 'number' && Number.isFinite(metrics[k]))
}
