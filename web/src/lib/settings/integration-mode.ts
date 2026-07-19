import { isDeployedRuntime } from '@/lib/config/supabase'

export type SupabaseIntegrationMode = 'official' | 'missing' | 'unavailable' | 'mock'

export function canUseLocalSettingsFallback(env: NodeJS.ProcessEnv = process.env) {
  return !isDeployedRuntime(env)
}

export function getSupabaseIntegrationMode(params: {
  ready: boolean
  envIssue: string | null
  deployed?: boolean
}): SupabaseIntegrationMode {
  if (params.ready) return 'official'
  if (params.deployed === false && params.envIssue) return 'mock'
  return params.envIssue ? 'missing' : 'unavailable'
}
