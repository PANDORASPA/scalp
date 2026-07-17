export type ScalpStorageUploadInput = {
  objectKey: string
  fileName: string
  contentType: string
  bytes: Buffer
}

export type ScalpStorageUploadResult = {
  provider: string
  fileId: string | null
  url: string
  objectKey: string
  publicAccess: boolean
}

export type ScalpStorageDownloadResult = {
  bytes: Buffer
  contentType: string
}

export type ScalpStorageAdapter = {
  provider: string
  upload(input: ScalpStorageUploadInput): Promise<ScalpStorageUploadResult>
  delete(fileId: string | null, objectKey: string | null): Promise<void>
  download?(fileId: string): Promise<ScalpStorageDownloadResult>
}
