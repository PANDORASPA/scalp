export type SupabaseIntegrationMode = 'official' | 'missing' | 'unavailable'

export function getSupabaseIntegrationMode(params: {
  ready: boolean
  envIssue: string | null
}): SupabaseIntegrationMode {
  if (params.ready) return 'official'
  return params.envIssue ? 'missing' : 'unavailable'
}
