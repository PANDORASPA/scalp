import type { CapturePointCode } from './constants'
import type { MetricInput, ScalpAiPointAnalysis, ScalpAiShotAnalysis } from './types'

import type { HairCountProviderResult } from './providers/types'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function computeCaptureConsistencyScore(readyCounts: number[]) {
  if (readyCounts.length !== 3) return null

  const avg = readyCounts.reduce((sum, value) => sum + value, 0) / readyCounts.length
  if (!Number.isFinite(avg) || avg <= 0) return null

  const variance =
    readyCounts.reduce((sum, value) => sum + (value - avg) ** 2, 0) / readyCounts.length
  const deviation = Math.sqrt(variance)
  const coefficientOfVariation = deviation / avg

  return round2(Math.max(0, Math.min(1, 1 - coefficientOfVariation / 0.35)))
}

function buildTrendSummary(params: {
  completed: boolean
  changeVsPrevious: number | null
  confidenceScore: number | null
  captureConsistencyScore: number | null
}) {
  const { completed, changeVsPrevious, confidenceScore, captureConsistencyScore } = params

  if (!completed) {
    return {
      trendDirection: 'inconclusive' as const,
      trendSummary: 'Complete all 3 shots before showing an AI hair-count trend.',
    }
  }

  if (changeVsPrevious === null) {
    return {
      trendDirection: 'inconclusive' as const,
      trendSummary: 'No previous AI baseline is available for trend comparison yet.',
    }
  }

  if (
    confidenceScore === null ||
    captureConsistencyScore === null ||
    confidenceScore < 0.55 ||
    captureConsistencyScore < 0.45
  ) {
    return {
      trendDirection: 'inconclusive' as const,
      trendSummary: 'A change is detected, but confidence is still too low to call a reliable trend.',
    }
  }

  if (Math.abs(changeVsPrevious) < 5) {
    return {
      trendDirection: 'stable' as const,
      trendSummary: 'Hair count looks stable. The change stays within the expected capture variance.',
    }
  }

  if (changeVsPrevious > 0) {
    return {
      trendDirection: 'improved' as const,
      trendSummary: 'Hair count trend is improving beyond the expected capture variance.',
    }
  }

  return {
    trendDirection: 'declined' as const,
    trendSummary: 'Hair count trend is lower than the previous session beyond the expected capture variance.',
  }
}

export function buildHairCountShotAnalysis(params: {
  customerId: string
  sessionId: string
  imageId: string
  capturePointCode: CapturePointCode
  shotIndex: 1 | 2 | 3
  nowISO: string
  result: HairCountProviderResult
  existing?: ScalpAiShotAnalysis
}): ScalpAiShotAnalysis {
  const { customerId, sessionId, imageId, capturePointCode, shotIndex, nowISO, result, existing } = params

  return {
    id: existing?.id ?? crypto.randomUUID(),
    customer_id: customerId,
    session_id: sessionId,
    image_id: imageId,
    capture_point_code: capturePointCode,
    shot_index: shotIndex,
    hair_count_estimate: result.hairCountEstimate,
    confidence_score: result.confidenceScore,
    provider_name: result.providerName,
    analysis_method: result.analysisMethod,
    model_version: result.modelVersion,
    status: result.status,
    notes: result.notes,
    fallback_used: result.fallbackUsed,
    fallback_reason: result.fallbackReason,
    raw_output_ref: result.rawOutputRef,
    created_at: existing?.created_at ?? nowISO,
    updated_at: nowISO,
  }
}

export function computeAiPointAnalysis(params: {
  customerId: string
  sessionId: string
  capturePointCode: CapturePointCode
  shotAnalyses: ScalpAiShotAnalysis[]
  nowISO: string
  existing?: ScalpAiPointAnalysis
  previous?: ScalpAiPointAnalysis | null
}): ScalpAiPointAnalysis {
  const { customerId, sessionId, capturePointCode, shotAnalyses, nowISO, existing, previous } = params

  const readyCounts = shotAnalyses
    .map((item) => item.hair_count_estimate)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const completed = readyCounts.length === 3
  const hair_count_avg_3shot = completed
    ? round2(readyCounts.reduce((sum, value) => sum + value, 0) / 3)
    : null
  const hair_count_min = completed ? Math.min(...readyCounts) : null
  const hair_count_max = completed ? Math.max(...readyCounts) : null
  const confidence_score = completed
    ? round2(
        shotAnalyses.reduce((sum, item) => sum + (item.confidence_score ?? 0), 0) / shotAnalyses.length,
      )
    : null
  const capture_consistency_score = computeCaptureConsistencyScore(readyCounts)
  const change_vs_previous =
    completed &&
    typeof previous?.hair_count_avg_3shot === 'number' &&
    Number.isFinite(previous.hair_count_avg_3shot)
      ? round2(hair_count_avg_3shot! - previous.hair_count_avg_3shot)
      : null
  const { trendDirection, trendSummary } = buildTrendSummary({
    completed,
    changeVsPrevious: change_vs_previous,
    confidenceScore: confidence_score,
    captureConsistencyScore: capture_consistency_score,
  })

  return {
    id: existing?.id ?? crypto.randomUUID(),
    customer_id: customerId,
    session_id: sessionId,
    capture_point_code: capturePointCode,
    hair_count_avg_3shot,
    hair_count_min,
    hair_count_max,
    completed,
    provider_name: shotAnalyses[0]?.provider_name ?? previous?.provider_name ?? 'none',
    analysis_method: shotAnalyses[0]?.analysis_method ?? previous?.analysis_method ?? 'baseline-density-v1',
    confidence_score,
    capture_consistency_score,
    change_vs_previous,
    fallback_used: shotAnalyses.some((item) => item.fallback_used),
    trend_direction: trendDirection,
    trend_summary: trendSummary,
    computed_at: nowISO,
  }
}
