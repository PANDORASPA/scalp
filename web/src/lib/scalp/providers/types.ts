import type { CapturePointCode } from '../constants'
import type { MetricInput } from '../types'

export type HairCountProviderInput = {
  customerId: string
  sessionId: string
  imageId: string
  imageUrl: string
  capturePointCode: CapturePointCode
  shotIndex: 1 | 2 | 3
  metrics: MetricInput
  nowISO: string
}

export type HairCountProviderResult = {
  hairCountEstimate: number | null
  confidenceScore: number | null
  providerName: string
  analysisMethod: string
  modelVersion: string | null
  status: 'pending' | 'ready'
  notes: string | null
  fallbackUsed: boolean
  fallbackReason: string | null
  rawOutputRef: string | null
}

export type HairCountProvider = {
  analyze(input: HairCountProviderInput): Promise<HairCountProviderResult>
}
