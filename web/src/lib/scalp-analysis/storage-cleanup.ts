import 'server-only'

import type { ScalpImageStorageRef } from '@/lib/supabase/repository'
import { deleteScalpImages } from '@/lib/supabase/storage'

import { planScalpImageStorageCleanup } from './storage-cleanup-plan'
import { googleDriveStorageAdapter } from './storage/google-drive'

export type StorageCleanupFailure<T> = {
  target: T
  message: string
}

export async function deleteStorageTargetsWithConcurrency<T>(
  targets: readonly T[],
  concurrency: number,
  deleteTarget: (target: T) => Promise<void>,
) {
  const failures: StorageCleanupFailure<T>[] = []
  let cursor = 0
  const safeConcurrency = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 1
  const workerCount = Math.min(safeConcurrency, targets.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < targets.length) {
        const target = targets[cursor]
        cursor += 1
        try {
          await deleteTarget(target)
        } catch (error) {
          failures.push({
            target,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }),
  )

  return { failures }
}

export async function cleanupScalpImageStorageRefs(refs: ScalpImageStorageRef[]) {
  const plan = planScalpImageStorageCleanup(refs)
  const failures: string[] = []

  const driveCleanup = await deleteStorageTargetsWithConcurrency(
    plan.googleDriveTargets,
    4,
    (target) => googleDriveStorageAdapter.delete(target.fileId, target.objectKey),
  )
  failures.push(...driveCleanup.failures.map((failure) => `google-drive:${failure.message}`))

  try {
    await deleteScalpImages(plan.supabasePaths)
  } catch (error) {
    failures.push(`supabase-storage:${error instanceof Error ? error.message : String(error)}`)
  }

  if (failures.length) {
    throw new Error(`storage_cleanup_failed: ${failures.join('; ')}`)
  }
}
