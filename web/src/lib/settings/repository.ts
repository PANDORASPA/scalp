import 'server-only'

import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { getSupabaseAdminClient } from '@/lib/supabase/client'
import { keepExistingSecretUnlessReplacement } from '@/lib/settings/secret-merge'

export type GoogleDriveSettings = {
  storageProvider?: 'google-drive' | 'demo'
  clientEmail?: string
  privateKey?: string
  folderId?: string
  publicAccess?: boolean
}

export type OpenAiSettings = {
  provider?: 'mock' | 'openai-5.5'
  apiKey?: string
  model?: string
  timeoutMs?: number
}

type AppSettings = {
  googleDrive: GoogleDriveSettings
  openAi: OpenAiSettings
}

const DEFAULT_SETTINGS: AppSettings = {
  googleDrive: {},
  openAi: {},
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeGoogleDriveSettings(value: unknown): GoogleDriveSettings {
  if (!isObject(value)) return {}
  const storageProvider =
    value.storageProvider === 'demo'
      ? 'demo'
      : value.storageProvider === 'google-drive'
        ? 'google-drive'
        : undefined
  return {
    storageProvider,
    clientEmail: typeof value.clientEmail === 'string' ? value.clientEmail.trim() : undefined,
    privateKey: typeof value.privateKey === 'string' ? value.privateKey.trim() : undefined,
    folderId: typeof value.folderId === 'string' ? value.folderId.trim() : undefined,
    publicAccess: value.publicAccess === true,
  }
}

function normalizeOpenAiSettings(value: unknown): OpenAiSettings {
  if (!isObject(value)) return {}
  const provider = value.provider === 'openai-5.5' ? 'openai-5.5' : value.provider === 'mock' ? 'mock' : undefined
  const timeoutMs = Number(value.timeoutMs)
  return {
    provider,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey.trim() : undefined,
    model: typeof value.model === 'string' ? value.model.trim() : undefined,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : undefined,
  }
}

export function hasCompleteGoogleDriveSettings(settings: GoogleDriveSettings) {
  return Boolean(settings.clientEmail && settings.privateKey && settings.folderId)
}

export function hasOpenAiApiKey(settings: OpenAiSettings) {
  return Boolean(settings.apiKey)
}

export async function getAppSettings(): Promise<AppSettings> {
  if (!hasSupabaseServerEnv()) return DEFAULT_SETTINGS

  try {
    const client = getSupabaseAdminClient()
    const { data, error } = await client.from('app_settings').select('key,value').in('key', ['google_drive', 'openai'])
    if (error) throw error

    const byKey = new Map((data ?? []).map((item) => [item.key as string, item.value]))
    return {
      googleDrive: normalizeGoogleDriveSettings(byKey.get('google_drive')),
      openAi: normalizeOpenAiSettings(byKey.get('openai')),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveGoogleDriveSettings(input: GoogleDriveSettings) {
  const current = await getAppSettings()
  const next = normalizeGoogleDriveSettings({
    storageProvider: input.storageProvider ?? current.googleDrive.storageProvider ?? 'google-drive',
    clientEmail: input.clientEmail?.trim() ? input.clientEmail : current.googleDrive.clientEmail,
    privateKey: keepExistingSecretUnlessReplacement(input.privateKey, current.googleDrive.privateKey),
    folderId: input.folderId?.trim() ? input.folderId : current.googleDrive.folderId,
    publicAccess: input.publicAccess ?? current.googleDrive.publicAccess ?? false,
  })

  const client = getSupabaseAdminClient()
  const { error } = await client.from('app_settings').upsert({
    key: 'google_drive',
    value: next,
  })
  if (error) throw new Error(`save_google_drive_settings_failed: ${error.message}`)
  return next
}

export async function saveOpenAiSettings(input: OpenAiSettings) {
  const current = await getAppSettings()
  const next = normalizeOpenAiSettings({
    provider: input.provider ?? current.openAi.provider ?? 'mock',
    apiKey: keepExistingSecretUnlessReplacement(input.apiKey, current.openAi.apiKey),
    model: input.model?.trim() ? input.model : current.openAi.model ?? 'gpt-5.5',
    timeoutMs: input.timeoutMs ?? current.openAi.timeoutMs ?? 30000,
  })

  const client = getSupabaseAdminClient()
  const { error } = await client.from('app_settings').upsert({
    key: 'openai',
    value: next,
  })
  if (error) throw new Error(`save_openai_settings_failed: ${error.message}`)
  return next
}
