import { isDeployedRuntime } from '@/lib/config/supabase'

export type SupabaseIntegrationMode = 'official' | 'missing' | 'unavailable'

export function canUseLocalSettingsFallback(env: NodeJS.ProcessEnv = process.env) {
  return !isDeployedRuntime(env)
}

export function getSupabaseIntegrationMode(params: {
  ready: boolean
  envIssue: string | null
}): SupabaseIntegrationMode {
  if (params.ready) return 'official'
  return params.envIssue ? 'missing' : 'unavailable'
}
