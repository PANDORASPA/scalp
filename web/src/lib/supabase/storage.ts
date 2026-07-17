import 'server-only'

import { getSupabaseServerEnv } from '@/lib/config/supabase'
import { buildScalpImageStoragePath } from '@/lib/supabase/storage-path'

import { getSupabaseAdminClient } from './client'

export { buildScalpImageStoragePath }

export function getScalpImageUrl(path: string) {
  return `/api/scalp-images/file?path=${encodeURIComponent(path)}`
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

  return getScalpImageUrl(params.path)
}

export async function downloadScalpImage(path: string) {
  const client = getSupabaseAdminClient()
  const env = getSupabaseServerEnv()
  const { data, error } = await client.storage.from(env.storageBucket).download(path)

  if (error || !data) {
    throw new Error(`Failed to download image from storage: ${error?.message || 'empty response'}`)
  }

  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || 'image/jpeg',
  }
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
