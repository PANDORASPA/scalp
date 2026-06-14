import 'server-only'

import { getAppSettings } from '@/lib/settings/repository'

import { demoStorageAdapter } from './demo'
import { googleDriveStorageAdapter } from './google-drive'
import type { ScalpStorageAdapter } from './types'

export async function getScalpStorageProviderName() {
  const settings = await getAppSettings()
  return settings.googleDrive.storageProvider ?? process.env.SCALP_ANALYSIS_STORAGE_PROVIDER?.trim() ?? 'google-drive'
}

export async function getScalpStorageAdapter(): Promise<ScalpStorageAdapter> {
  const provider = await getScalpStorageProviderName()

  if (provider === 'google-drive') return googleDriveStorageAdapter
  if (provider === 'demo') return demoStorageAdapter

  throw new Error(
    `Unsupported scalp analysis storage provider "${provider}". Configure SCALP_ANALYSIS_STORAGE_PROVIDER=google-drive or demo.`,
  )
}
