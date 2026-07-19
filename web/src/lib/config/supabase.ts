export type SupabaseServerEnv = {
  url: string
  serviceRoleKey: string
  storageBucket: string
}

export const SUPABASE_LOCAL_FALLBACK_MESSAGE =
  'Supabase server env is not configured. Local development may use mock mode, but deployed environments require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and never persist to local mock files.'

export function getSupabaseServerEnvIssue(env: NodeJS.ProcessEnv = process.env) {
  const url = env.SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url) return 'SUPABASE_URL is missing.'
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return 'SUPABASE_URL must start with https://.'
  } catch {
    return 'SUPABASE_URL is not a valid URL.'
  }

  if (!serviceRoleKey) return 'SUPABASE_SERVICE_ROLE_KEY is missing.'
  if (!serviceRoleKey.startsWith('eyJ') || serviceRoleKey.split('.').length !== 3 || serviceRoleKey.length < 100) {
    return 'SUPABASE_SERVICE_ROLE_KEY does not look like a valid service role JWT.'
  }

  return null
}

export function hasSupabaseServerEnv(env: NodeJS.ProcessEnv = process.env) {
  return getSupabaseServerEnvIssue(env) === null
}

export function isDeployedRuntime(env: NodeJS.ProcessEnv = process.env) {
  return env.VERCEL === '1' || Boolean(env.VERCEL_ENV)
}

export function shouldUseSupabaseDataSource(env: NodeJS.ProcessEnv = process.env) {
  return hasSupabaseServerEnv(env) || isDeployedRuntime(env)
}

export function getSupabaseServerEnv(env: NodeJS.ProcessEnv = process.env): SupabaseServerEnv {
  const url = env.SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  const issue = getSupabaseServerEnvIssue(env)
  if (issue) {
    throw new Error(
      `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required: ${issue} ${SUPABASE_LOCAL_FALLBACK_MESSAGE}`,
    )
  }

  return {
    url: url!,
    serviceRoleKey: serviceRoleKey!,
    storageBucket: env.SUPABASE_STORAGE_BUCKET?.trim() || 'scalp-images',
  }
}

export function explainSupabaseErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('supabase_url and supabase_service_role_key')) {
    return `supabase_env_missing: ${SUPABASE_LOCAL_FALLBACK_MESSAGE}`
  }

  if (
    normalized.includes('fetch failed') ||
    normalized.includes('getaddrinfo') ||
    normalized.includes('enotfound') ||
    normalized.includes('ebusy') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')
  ) {
    return `supabase_connection_failed: ${message}. Copy SUPABASE_URL directly from Supabase Project Settings > API > Project URL, update Vercel Production env, then redeploy.`
  }

  if (
    normalized.includes('relation') ||
    normalized.includes('does not exist') ||
    normalized.includes('column') ||
    normalized.includes('schema cache')
  ) {
    return `supabase_schema_missing: ${message}. Run migrations through 20260719133000 before enabling Supabase mode.`
  }

  if (
    normalized.includes('bucket') ||
    normalized.includes('storage') ||
    normalized.includes('object not found') ||
    normalized.includes('not found')
  ) {
    return `supabase_storage_error: ${message}. Confirm the storage bucket exists and is named "${process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'scalp-images'}".`
  }

  return `supabase_error: ${message}`
}
