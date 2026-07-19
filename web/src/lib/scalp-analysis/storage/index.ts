import 'server-only'

import { hasSupabaseServerEnv, isDeployedRuntime } from '@/lib/config/supabase'
import { getAppSettings } from '@/lib/settings/repository'

import { demoStorageAdapter } from './demo'
import { googleDriveStorageAdapter } from './google-drive'
import type { ScalpStorageAdapter } from './types'

export function resolveScalpStorageProvider(
  configuredProvider: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (configuredProvider?.trim()) return configuredProvider.trim()
  if (env.SCALP_ANALYSIS_STORAGE_PROVIDER?.trim()) return env.SCALP_ANALYSIS_STORAGE_PROVIDER.trim()
  return !isDeployedRuntime(env) && !hasSupabaseServerEnv(env) ? 'demo' : 'google-drive'
}

export async function getScalpStorageProviderName() {
  const settings = await getAppSettings()
  return resolveScalpStorageProvider(settings.googleDrive.storageProvider)
}

export async function getScalpStorageAdapter(providerOverride?: string): Promise<ScalpStorageAdapter> {
  const provider = providerOverride ?? (await getScalpStorageProviderName())

  if (provider === 'google-drive') return googleDriveStorageAdapter
  if (provider === 'demo') return demoStorageAdapter

  throw new Error(
    `Unsupported scalp analysis storage provider "${provider}". Configure SCALP_ANALYSIS_STORAGE_PROVIDER=google-drive or demo.`,
  )
}
