import type { IntegrationStatus } from './status'

export type HealthStatus = 'official_ready' | 'operational_with_demo_integrations' | 'not_ready'

export type HealthVersion = {
  commit: string | null
  branch: string | null
  deploymentUrl: string | null
}

export type HealthBlocker = {
  key: string
  label: string
  mode: IntegrationStatus['mode']
  details: string
  nextAction: string | null
}

export type HealthSummary = {
  ok: boolean
  officialReady: boolean
  status: HealthStatus
  checkedAt: string
  version: HealthVersion
  integrations: IntegrationStatus[]
  blockers: HealthBlocker[]
}

export function buildHealthSummary(params: {
  integrations: IntegrationStatus[]
  checkedAt: string
  version: HealthVersion
}): HealthSummary {
  const operationalReady = params.integrations.every((item) => item.ready)
  const officialReady = params.integrations.every((item) => item.officialReady)

  return {
    ok: operationalReady,
    officialReady,
    status: officialReady
      ? 'official_ready'
      : operationalReady
        ? 'operational_with_demo_integrations'
        : 'not_ready',
    checkedAt: params.checkedAt,
    version: params.version,
    integrations: params.integrations,
    blockers: params.integrations
      .filter((item) => !item.officialReady)
      .map((item) => ({
        key: item.key,
        label: item.label,
        mode: item.mode,
        details: item.details,
        nextAction: item.nextAction ?? null,
      })),
  }
}
