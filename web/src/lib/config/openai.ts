export type OpenAiVisionEnv = {
  apiKey: string
  model: string
  timeoutMs: number
}

type OpenAiSettingsSource = {
  apiKey?: string
  model?: string
  timeoutMs?: number
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

export function getOpenAiVisionEnv(env: NodeJS.ProcessEnv = process.env): OpenAiVisionEnv {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when SCALP_ANALYSIS_AI_PROVIDER=openai-5.5.')
  }

  return {
    apiKey,
    model: env.OPENAI_VISION_MODEL?.trim() || 'gpt-5.5',
    timeoutMs: toPositiveInt(env.OPENAI_VISION_TIMEOUT_MS, 30000),
  }
}

export function getOpenAiVisionEnvFromSettings(settings: OpenAiSettingsSource): OpenAiVisionEnv {
  const apiKey = settings.apiKey?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when SCALP_ANALYSIS_AI_PROVIDER=openai-5.5.')
  }

  return {
    apiKey,
    model: settings.model?.trim() || 'gpt-5.5',
    timeoutMs: settings.timeoutMs && settings.timeoutMs > 0 ? Math.round(settings.timeoutMs) : 30000,
  }
}
