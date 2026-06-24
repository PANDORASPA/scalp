import 'server-only'

import type { ScalpImageStorageRef } from '@/lib/supabase/repository'
import { deleteScalpImages } from '@/lib/supabase/storage'

import { planScalpImageStorageCleanup } from './storage-cleanup-plan'
import { googleDriveStorageAdapter } from './storage/google-drive'

function logStorageCleanupFailure(context: string, error: unknown) {
  console.warn(`Scalp image storage cleanup failed (${context})`, error)
}

export async function cleanupScalpImageStorageRefs(refs: ScalpImageStorageRef[]) {
  const plan = planScalpImageStorageCleanup(refs)

  for (const target of plan.googleDriveTargets) {
    await googleDriveStorageAdapter
      .delete(target.fileId, target.objectKey)
      .catch((error) => logStorageCleanupFailure(`google-drive:${target.fileId ?? target.objectKey ?? 'unknown'}`, error))
  }

  await deleteScalpImages(plan.supabasePaths).catch((error) => logStorageCleanupFailure('supabase-storage', error))
}
