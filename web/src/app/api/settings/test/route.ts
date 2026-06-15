import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
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
      const status = (await getSystemStatus()).find((item) => item.key === 'supabase')
      if (!status?.ready) {
        return NextResponse.json({ ok: false, message: status?.details ?? 'Supabase 未連通。' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, message: 'Supabase 資料庫連線正常。' })
    }

    if (target === 'google-drive') {
      const storageProvider = await getScalpStorageProviderName()
      if (storageProvider === 'demo') {
        return NextResponse.json({
          ok: true,
          message: '目前使用 Demo storage，完整流程可測試；正式圖片請切回 Google Drive 後再測。',
        })
      }
      const result = await testGoogleDriveConnection()
      return NextResponse.json({
        ok: true,
        message: `Google Drive 連線正常，folder: ${result.folderName}`,
      })
    }

    const aiStatus = (await getSystemStatus()).find((item) => item.key === 'scalp-ai')
    if (aiStatus?.details.includes('mock AI')) {
      return NextResponse.json({
        ok: true,
        message: '目前使用 Mock AI，流程可測試；切換 OpenAI Vision 後可再測真 API。',
      })
    }
    const result = await testOpenAiVisionConnection()
    return NextResponse.json({
      ok: true,
      message: `OpenAI 連線正常，model: ${result.model}`,
    })
  } catch (error) {
    return toFailure(error)
  }
}
