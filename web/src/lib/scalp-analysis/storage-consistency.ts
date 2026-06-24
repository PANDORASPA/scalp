import type { ScalpStorageAdapter, ScalpStorageUploadResult } from './storage/types'

export type StorageCleanupTarget = {
  fileId: string | null
  objectKey: string | null
}

type CleanupLogger = (message: string, error: unknown) => void

export async function deleteStorageBestEffort(params: {
  adapter: ScalpStorageAdapter
  target: StorageCleanupTarget
  context: string
  logger?: CleanupLogger
}) {
  if (!params.target.fileId && !params.target.objectKey) return
  try {
    await params.adapter.delete(params.target.fileId, params.target.objectKey)
  } catch (error) {
    const logger = params.logger ?? console.warn
    logger(`Scalp analysis storage cleanup failed (${params.context})`, error)
  }
}

export async function commitUploadedStorageRecord<T>(params: {
  adapter: ScalpStorageAdapter
  uploaded: ScalpStorageUploadResult
  writeRecord: () => Promise<T>
  logger?: CleanupLogger
}) {
  try {
    return await params.writeRecord()
  } catch (error) {
    await deleteStorageBestEffort({
      adapter: params.adapter,
      target: {
        fileId: params.uploaded.fileId,
        objectKey: params.uploaded.objectKey,
      },
      context: 'new upload rollback after database failure',
      logger: params.logger,
    })
    throw error
  }
}
