import 'server-only'

import type { ScalpImageStorageRef } from '@/lib/supabase/repository'
import { buildScalpImageStoragePath, deleteScalpImages } from '@/lib/supabase/storage'

import { googleDriveStorageAdapter } from './storage/google-drive'

function logStorageCleanupFailure(context: string, error: unknown) {
  console.warn(`Scalp image storage cleanup failed (${context})`, error)
}

export async function cleanupScalpImageStorageRefs(refs: ScalpImageStorageRef[]) {
  const supabasePaths: string[] = []

  for (const ref of refs) {
    if (ref.storage_provider === 'google-drive') {
      await googleDriveStorageAdapter
        .delete(ref.drive_file_id, ref.storage_object_key)
        .catch((error) => logStorageCleanupFailure(`google-drive:${ref.drive_file_id ?? ref.storage_object_key ?? 'unknown'}`, error))
      continue
    }

    if (ref.storage_provider === 'demo') continue

    supabasePaths.push(
      ref.storage_object_key ||
        buildScalpImageStoragePath({
          customerId: ref.customer_id,
          sessionId: ref.session_id,
          capturePointCode: ref.capture_point_code,
          shotIndex: ref.shot_index,
        }),
    )
  }

  await deleteScalpImages(supabasePaths).catch((error) => logStorageCleanupFailure('supabase-storage', error))
}
