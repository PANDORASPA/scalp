export type IntegrationMode = 'official' | 'demo' | 'mock' | 'missing' | 'unavailable'

export type IntegrationStatus = {
  key: string
  ready: boolean
  officialReady?: boolean
  mode?: IntegrationMode
  label?: string
  requiredFor?: string
  details?: string
  nextAction?: string
}

export type SettingsStatusResponse = {
  integrations: IntegrationStatus[]
}

export function getIntegrationStatus(
  integrations: IntegrationStatus[],
  key: string,
) {
  return integrations.find((item) => item.key === key) ?? null
}

export function isIntegrationReady(integrations: IntegrationStatus[], key: string) {
  return getIntegrationStatus(integrations, key)?.ready === true
}
