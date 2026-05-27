import 'server-only'

import { googleDriveStorageAdapter } from './google-drive'
import type { ScalpStorageAdapter } from './types'

export function getScalpStorageAdapter(): ScalpStorageAdapter {
  const provider = process.env.SCALP_ANALYSIS_STORAGE_PROVIDER?.trim() || 'google-drive'

  if (provider === 'google-drive') return googleDriveStorageAdapter

  throw new Error(
    `Unsupported scalp analysis storage provider "${provider}". Configure SCALP_ANALYSIS_STORAGE_PROVIDER=google-drive for now.`,
  )
}
