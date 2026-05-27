import type { HairCountProvider, HairCountProviderInput, HairCountProviderResult } from './types'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function buildHeuristicHairCountResult(params: {
  input: HairCountProviderInput
  fallbackReason?: string | null
}): HairCountProviderResult {
  const { input, fallbackReason = null } = params
  const density = input.metrics.density_score
  const blockage = input.metrics.blockage_score ?? 0
  const dandruff = input.metrics.dandruff_score ?? 0
  const redness = input.metrics.redness_score ?? 0

  if (typeof density !== 'number' || !Number.isFinite(density)) {
    return {
      hairCountEstimate: null,
      confidenceScore: null,
      providerName: 'heuristic',
      analysisMethod: 'baseline-density-v1',
      modelVersion: 'heuristic-2026-03-18',
      status: 'pending',
      notes: fallbackReason
        ? `Using fallback analysis. ${fallbackReason}`
        : 'Awaiting density score before estimating hair count.',
      fallbackUsed: fallbackReason !== null,
      fallbackReason,
      rawOutputRef: null,
    }
  }

  return {
    hairCountEstimate: Math.max(
      0,
      Math.round(28 + density * 11 - blockage * 1.4 - dandruff * 0.9 - redness * 0.4),
    ),
    confidenceScore: round2(Math.min(0.78, 0.42 + density * 0.03)),
    providerName: 'heuristic',
    analysisMethod: 'baseline-density-v1',
    modelVersion: 'heuristic-2026-03-18',
    status: 'ready',
    notes: fallbackReason
      ? `Using fallback analysis. ${fallbackReason}`
      : 'Baseline estimate derived from manual scalp scores. Replace with CV model later.',
    fallbackUsed: fallbackReason !== null,
    fallbackReason,
    rawOutputRef: null,
  }
}

export function createHeuristicHairCountProvider(params?: {
  fallbackReason?: string | null
}): HairCountProvider {
  return {
    async analyze(input) {
      return buildHeuristicHairCountResult({
        input,
        fallbackReason: params?.fallbackReason ?? null,
      })
    },
  }
}
