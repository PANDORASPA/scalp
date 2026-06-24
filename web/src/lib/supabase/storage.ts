import 'server-only'

import { getSupabaseServerEnv } from '@/lib/config/supabase'
import { buildScalpImageStoragePath } from '@/lib/supabase/storage-path'

import { getSupabaseAdminClient } from './client'

export { buildScalpImageStoragePath }

export function getScalpImagePublicUrl(path: string) {
  const env = getSupabaseServerEnv()
  return `${env.url}/storage/v1/object/public/${env.storageBucket}/${path}`
}

export async function uploadScalpImage(params: {
  path: string
  bytes: Buffer
  contentType: string
}) {
  const client = getSupabaseAdminClient()
  const env = getSupabaseServerEnv()

  const { error } = await client.storage.from(env.storageBucket).upload(params.path, params.bytes, {
    contentType: params.contentType,
    upsert: true,
  })

  if (error) {
    throw new Error(`Failed to upload image to storage: ${error.message}`)
  }

  return getScalpImagePublicUrl(params.path)
}

export async function deleteScalpImages(paths: string[]) {
  if (paths.length === 0) return

  const client = getSupabaseAdminClient()
  const env = getSupabaseServerEnv()
  const { error } = await client.storage.from(env.storageBucket).remove(paths)

  if (error) {
    throw new Error(`Failed to delete image(s) from storage: ${error.message}`)
  }
}
