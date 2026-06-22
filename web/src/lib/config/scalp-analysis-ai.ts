export type ScalpAnalysisAiProvider = 'mock' | 'openai-5.5'

export function normalizeScalpAnalysisAiProvider(value: string | null | undefined): ScalpAnalysisAiProvider {
  return value?.trim().toLowerCase() === 'openai-5.5' ? 'openai-5.5' : 'mock'
}
