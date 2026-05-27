export type SupabaseServerEnv = {
  url: string
  serviceRoleKey: string
  storageBucket: string
}

export const SUPABASE_LOCAL_FALLBACK_MESSAGE =
  'Supabase server env is not configured. The app will stay in local mock mode until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'

export function hasSupabaseServerEnv(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export function getSupabaseServerEnv(env: NodeJS.ProcessEnv = process.env): SupabaseServerEnv {
  const url = env.SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error(
      `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. ${SUPABASE_LOCAL_FALLBACK_MESSAGE}`,
    )
  }

  return {
    url,
    serviceRoleKey,
    storageBucket: env.SUPABASE_STORAGE_BUCKET?.trim() || 'scalp-images',
  }
}

export function explainSupabaseErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('supabase_url and supabase_service_role_key')) {
    return `supabase_env_missing: ${SUPABASE_LOCAL_FALLBACK_MESSAGE}`
  }

  if (
    normalized.includes('relation') ||
    normalized.includes('does not exist') ||
    normalized.includes('column') ||
    normalized.includes('schema cache')
  ) {
    return `supabase_schema_missing: ${message}. Run migrations 0001, 0002, and 0003 before enabling Supabase mode.`
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
