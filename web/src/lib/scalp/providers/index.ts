import { getScalpAiEnv } from '../../config/env'

import { createHeuristicHairCountProvider } from './heuristic'
import { createHttpHairCountProvider } from './http-provider'
import type { HairCountProvider, HairCountProviderInput, HairCountProviderResult } from './types'

export function getHairCountProvider(): HairCountProvider {
  const env = getScalpAiEnv()

  if (env.provider === 'http') {
    return createHttpHairCountProvider(env)
  }

  return createHeuristicHairCountProvider()
}

export async function runHairCountInference(
  input: HairCountProviderInput,
): Promise<HairCountProviderResult> {
  const env = getScalpAiEnv()
  const provider = getHairCountProvider()

  try {
    return await provider.analyze(input)
  } catch (error) {
    if (!env.allowFallback) {
      return {
        hairCountEstimate: null,
        confidenceScore: null,
        providerName: env.provider,
        analysisMethod: env.provider === 'http' ? 'remote-hair-count-v1' : 'baseline-density-v1',
        modelVersion: env.model,
        status: 'pending',
        notes: 'AI provider is unavailable and fallback is disabled.',
        fallbackUsed: false,
        fallbackReason: null,
        rawOutputRef: null,
      }
    }

    const fallbackReason =
      error instanceof Error ? error.message : 'Provider unavailable. Falling back to heuristic analysis.'

    return createHeuristicHairCountProvider({
      fallbackReason,
    }).analyze(input)
  }
}
