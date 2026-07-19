import type { ScalpStorageAdapter, ScalpStorageUploadResult } from './storage/types'

export type StorageCleanupTarget = {
  fileId: string | null
  objectKey: string | null
}

export function shouldRollbackUploadedStorageOnRecordFailure(params: {
  hasExistingRecord: boolean
  uploaded: Pick<ScalpStorageUploadResult, 'replacesExistingObject'>
}) {
  // A same-key upsert still backs the old row, so deleting it would create a broken reference.
  return !params.hasExistingRecord || !params.uploaded.replacesExistingObject
}

type CleanupLogger = (message: string, error: unknown) => void

export async function deleteStorageRequired(params: {
  adapter: ScalpStorageAdapter
  target: StorageCleanupTarget
}) {
  if (!params.target.fileId && !params.target.objectKey) return
  await params.adapter.delete(params.target.fileId, params.target.objectKey)
}

export async function deleteStorageBestEffort(params: {
  adapter: ScalpStorageAdapter
  target: StorageCleanupTarget
  context: string
  logger?: CleanupLogger
}) {
  if (!params.target.fileId && !params.target.objectKey) return
  try {
    await deleteStorageRequired(params)
  } catch (error) {
    const logger = params.logger ?? console.warn
    logger(`Scalp analysis storage cleanup failed (${params.context})`, error)
  }
}

export async function commitUploadedStorageRecord<T>(params: {
  adapter: ScalpStorageAdapter
  uploaded: ScalpStorageUploadResult
  writeRecord: () => Promise<T>
  rollbackOnWriteFailure?: boolean
  logger?: CleanupLogger
}) {
  try {
    return await params.writeRecord()
  } catch (error) {
    if (params.rollbackOnWriteFailure !== false) {
      await deleteStorageBestEffort({
        adapter: params.adapter,
        target: {
          fileId: params.uploaded.fileId,
          objectKey: params.uploaded.objectKey,
        },
        context: 'new upload rollback after database failure',
        logger: params.logger,
      })
    }
    throw error
  }
}
