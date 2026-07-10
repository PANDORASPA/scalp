import 'server-only'

import dns from 'node:dns/promises'

import { getSupabaseServerEnv, getSupabaseServerEnvIssue } from '@/lib/config/supabase'

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

  try {
    const res = await fetch(`${env.url}/rest/v1/scalp_capture_points?select=id&limit=1`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Supabase REST check failed: ${res.status} ${text}`)
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
