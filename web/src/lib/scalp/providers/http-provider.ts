import type { ScalpAiEnv } from '../../config/env'

import type { HairCountProvider, HairCountProviderInput, HairCountProviderResult } from './types'

type HttpProviderResponse = {
  hair_count_estimate?: number | null
  confidence_score?: number | null
  analysis_method?: string | null
  model_version?: string | null
  notes?: string | null
  raw_output_ref?: string | null
  status?: 'pending' | 'ready'
}

function toFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function createHttpHairCountProvider(env: ScalpAiEnv): HairCountProvider {
  return {
    async analyze(input: HairCountProviderInput): Promise<HairCountProviderResult> {
      if (!env.baseUrl) {
        throw new Error('SCALP_AI_BASE_URL is required for http provider')
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), env.timeoutMs)

      try {
        const response = await fetch(env.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(env.apiKey ? { Authorization: `Bearer ${env.apiKey}` } : {}),
          },
          body: JSON.stringify({
            customer_id: input.customerId,
            session_id: input.sessionId,
            image_id: input.imageId,
            image_url: input.imageUrl,
            capture_point_code: input.capturePointCode,
            shot_index: input.shotIndex,
            metrics: input.metrics,
            model: env.model,
          }),
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Provider responded with ${response.status}`)
        }

        const json = (await response.json()) as HttpProviderResponse
        return {
          hairCountEstimate: toFiniteNumber(json.hair_count_estimate),
          confidenceScore: toFiniteNumber(json.confidence_score),
          providerName: 'http',
          analysisMethod: json.analysis_method?.trim() || 'remote-hair-count-v1',
          modelVersion: json.model_version?.trim() || env.model,
          status: json.status === 'pending' ? 'pending' : 'ready',
          notes: json.notes?.trim() || 'Remote provider analysis completed.',
          fallbackUsed: false,
          fallbackReason: null,
          rawOutputRef: json.raw_output_ref?.trim() || null,
        }
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
