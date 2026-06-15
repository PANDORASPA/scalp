import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { getSupabaseServerEnv } from '@/lib/config/supabase'
import { testOpenAiVisionConnection } from '@/lib/scalp-analysis/openai-vision'
import { getScalpStorageProviderName } from '@/lib/scalp-analysis/storage'
import { testGoogleDriveConnection } from '@/lib/scalp-analysis/storage/google-drive'
import { getSystemStatus } from '@/lib/settings/status'

export const runtime = 'nodejs'

type TestTarget = 'supabase' | 'google-drive' | 'scalp-ai'

function isTarget(value: unknown): value is TestTarget {
  return value === 'supabase' || value === 'google-drive' || value === 'scalp-ai'
}

function toFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'connection_test_failed'
  return NextResponse.json({ ok: false, message }, { status: 500 })
}

async function testSupabaseConnection() {
  const env = getSupabaseServerEnv()
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
}

export async function POST(req: Request) {
  const auth = await requireAuthRole(['admin'])
  if (!auth.ok) return auth.response

  const body = (await req.json().catch(() => null)) as { target?: unknown } | null
  const target = body?.target
  if (!isTarget(target)) {
    return NextResponse.json({ ok: false, message: 'invalid_test_target' }, { status: 400 })
  }

  try {
    if (target === 'supabase') {
      await testSupabaseConnection()
      return NextResponse.json({ ok: true, message: 'Supabase database connection is healthy.' })
    }

    if (target === 'google-drive') {
      const storageProvider = await getScalpStorageProviderName()
      if (storageProvider === 'demo') {
        return NextResponse.json({
          ok: true,
          message: 'Demo storage is active. The flow can be tested, but real images should use Google Drive.',
        })
      }
      const result = await testGoogleDriveConnection()
      return NextResponse.json({
        ok: true,
        message: `Google Drive connection is healthy. Folder: ${result.folderName}`,
      })
    }

    const aiStatus = (await getSystemStatus()).find((item) => item.key === 'scalp-ai')
    if (aiStatus?.mode === 'mock') {
      return NextResponse.json({
        ok: true,
        message: 'Mock AI is active. The flow can be tested; switch to OpenAI Vision to verify the real API.',
      })
    }
    const result = await testOpenAiVisionConnection()
    return NextResponse.json({
      ok: true,
      message: `OpenAI connection is healthy. Model: ${result.model}`,
    })
  } catch (error) {
    return toFailure(error)
  }
}
