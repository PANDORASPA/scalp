import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { getSystemStatus } from '@/lib/settings/status'
import { saveGoogleDriveSettings, saveOpenAiSettings } from '@/lib/settings/repository'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  return NextResponse.json({
    integrations: await getSystemStatus(),
    updated_at: new Date().toISOString(),
  })
}

export async function POST(req: Request) {
  const auth = await requireAuthRole(['admin'])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as {
    googleDrive?: {
      storageProvider?: 'google-drive' | 'demo'
      clientEmail?: string
      privateKey?: string
      folderId?: string
    }
    openAi?: {
      provider?: 'mock' | 'openai-5.5'
      apiKey?: string
      model?: string
      timeoutMs?: number
    }
  }

  try {
    if (body.googleDrive) {
      await saveGoogleDriveSettings(body.googleDrive)
    }
    if (body.openAi) {
      await saveOpenAiSettings(body.openAi)
    }
    return NextResponse.json({
      integrations: await getSystemStatus(),
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'settings_save_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
