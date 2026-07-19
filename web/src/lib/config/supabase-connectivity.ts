import 'server-only'

import dns from 'node:dns/promises'

import { getSupabaseServerEnv, getSupabaseServerEnvIssue } from '@/lib/config/supabase'
import { SCALP_ANALYSIS_AREA_KEYS } from '@/lib/scalp-analysis/constants'

export const SUPABASE_REQUIRED_TABLES = [
  'customers',
  'scalp_sessions',
  'scalp_capture_points',
  'scalp_images',
  'scalp_image_metrics',
  'scalp_point_summaries',
  'scalp_comparisons',
  'scalp_ai_shot_analyses',
  'scalp_ai_point_analyses',
  'scalp_area_summaries',
  'app_settings',
] as const

export function getMissingCapturePointCodes(codes: readonly string[]) {
  const present = new Set(codes)
  return SCALP_ANALYSIS_AREA_KEYS.filter((code) => !present.has(code))
}

export type SupabaseConnectivityResult = {
  ok: true
  url: string
  hostname: string
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause
  if (cause instanceof Error && cause.message) return `${error.message}: ${cause.message}`
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
    return `${error.message}: ${cause.message}`
  }
  return error.message
}

export function explainSupabaseConnectivityError(error: unknown) {
  const message = getErrorMessage(error)
  if (message.toLowerCase().includes('getaddrinfo') || message.toLowerCase().includes('dns')) {
    return `${message}. Copy SUPABASE_URL directly from Supabase Project Settings > API > Project URL, then update Vercel Production env and redeploy.`
  }
  if (message.toLowerCase().includes('fetch failed')) {
    return `${message}. Verify SUPABASE_URL by copying the Project URL from Supabase Settings > API; the dashboard project ref alone may not be enough if the API hostname does not resolve.`
  }
  return message
}

export async function testSupabaseConnectivity(): Promise<SupabaseConnectivityResult> {
  const envIssue = getSupabaseServerEnvIssue()
  if (envIssue) {
    throw new Error(`Supabase env is not ready: ${envIssue}`)
  }

  const env = getSupabaseServerEnv()
  const parsed = new URL(env.url)

  try {
    await dns.lookup(parsed.hostname)
  } catch (error) {
    throw new Error(`Supabase DNS check failed for ${parsed.hostname}: ${getErrorMessage(error)}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const headers = {
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
  }

  try {
    const capturePointsRes = await fetch(
      `${env.url}/rest/v1/scalp_capture_points?select=code&limit=100`,
      {
        method: 'GET',
        signal: controller.signal,
        headers,
      },
    )

    if (!capturePointsRes.ok) {
      const text = await capturePointsRes.text()
      throw new Error(`Supabase REST check failed: ${capturePointsRes.status} ${text}`)
    }

    const capturePoints = (await capturePointsRes.json()) as Array<{ code?: string }>
    const missingCapturePointCodes = getMissingCapturePointCodes(
      capturePoints.map((point) => point.code).filter((code): code is string => Boolean(code)),
    )
    if (missingCapturePointCodes.length > 0) {
      throw new Error(
        `Supabase schema check failed: missing scalp capture points: ${missingCapturePointCodes.join(', ')}`,
      )
    }

    await Promise.all(
      SUPABASE_REQUIRED_TABLES.filter((table) => table !== 'scalp_capture_points').map(async (table) => {
        const tableRes = await fetch(`${env.url}/rest/v1/${table}?select=id&limit=1`, {
          method: 'GET',
          signal: controller.signal,
          headers,
        })
        if (!tableRes.ok) {
          const text = await tableRes.text()
          throw new Error(`Supabase schema check failed for ${table}: ${tableRes.status} ${text}`)
        }
      }),
    )

    const bucketRes = await fetch(
      `${env.url}/storage/v1/bucket/${encodeURIComponent(env.storageBucket)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers,
      },
    )
    const bucketPayload = (await bucketRes.json().catch(() => null)) as {
      public?: boolean
      message?: string
    } | null
    if (!bucketRes.ok) {
      throw new Error(
        `Supabase storage bucket check failed: ${bucketRes.status} ${bucketPayload?.message || 'bucket unavailable'}`,
      )
    }
    if (bucketPayload?.public === true) {
      throw new Error(
        `Supabase storage bucket "${env.storageBucket}" is public. Run migration 20260717195041_harden_scalp_data_access.sql.`,
      )
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Supabase REST check failed: timeout after 10000ms')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  return {
    ok: true,
    url: parsed.origin,
    hostname: parsed.hostname,
  }
}
