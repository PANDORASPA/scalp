import { buildScalpImageStoragePath } from '../supabase/storage-path'

export type ScalpImageStorageCleanupRef = {
  customer_id: string
  session_id: string
  capture_point_code: string
  shot_index: 1 | 2 | 3
  drive_file_id: string | null
  storage_provider: string | null
  storage_object_key: string | null
}

export type ScalpImageStorageCleanupPlan = {
  googleDriveTargets: Array<{
    fileId: string | null
    objectKey: string | null
  }>
  supabasePaths: string[]
}

export function planScalpImageStorageCleanup(refs: ScalpImageStorageCleanupRef[]): ScalpImageStorageCleanupPlan {
  const googleDriveTargets: ScalpImageStorageCleanupPlan['googleDriveTargets'] = []
  const supabasePaths: string[] = []

  for (const ref of refs) {
    if (ref.storage_provider === 'google-drive') {
      googleDriveTargets.push({
        fileId: ref.drive_file_id,
        objectKey: ref.storage_object_key,
      })
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

  return { googleDriveTargets, supabasePaths }
}
