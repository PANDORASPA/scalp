import 'server-only'

import type { ScalpImageStorageRef } from '@/lib/supabase/repository'
import { deleteScalpImages } from '@/lib/supabase/storage'

import { planScalpImageStorageCleanup } from './storage-cleanup-plan'
import { googleDriveStorageAdapter } from './storage/google-drive'

export async function cleanupScalpImageStorageRefs(refs: ScalpImageStorageRef[]) {
  const plan = planScalpImageStorageCleanup(refs)
  const failures: string[] = []

  for (const target of plan.googleDriveTargets) {
    try {
      await googleDriveStorageAdapter.delete(target.fileId, target.objectKey)
    } catch (error) {
      failures.push(`google-drive:${error instanceof Error ? error.message : String(error)}`)
    }
  }

  try {
    await deleteScalpImages(plan.supabasePaths)
  } catch (error) {
    failures.push(`supabase-storage:${error instanceof Error ? error.message : String(error)}`)
  }

  if (failures.length) {
    throw new Error(`storage_cleanup_failed: ${failures.join('; ')}`)
  }
}
