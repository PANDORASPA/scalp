type ProviderName = 'heuristic' | 'http'

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

function toBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false
  return fallback
}

export type ScalpAiEnv = {
  provider: ProviderName
  baseUrl: string | null
  apiKey: string | null
  model: string | null
  timeoutMs: number
  allowFallback: boolean
}

export function getScalpAiEnv(env: NodeJS.ProcessEnv = process.env): ScalpAiEnv {
  const providerRaw = (env.SCALP_AI_PROVIDER ?? 'heuristic').toLowerCase()
  const provider: ProviderName = providerRaw === 'http' ? 'http' : 'heuristic'

  return {
    provider,
    baseUrl: env.SCALP_AI_BASE_URL?.trim() || null,
    apiKey: env.SCALP_AI_API_KEY?.trim() || null,
    model: env.SCALP_AI_MODEL?.trim() || null,
    timeoutMs: toPositiveInt(env.SCALP_AI_TIMEOUT_MS, 2500),
    allowFallback: toBool(env.SCALP_AI_ALLOW_FALLBACK, true),
  }
}
